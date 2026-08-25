using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Application.Tests.TestSupport;
using OrderService.Application.UseCases;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using Xunit;

namespace OrderService.Application.Tests;

public class SepayWebhookRegressionTests
{
    [Fact]
    public async Task DuplicateWebhook_ForSuccessfulPayment_IsNoOp()
    {
        var order = TransferOrder(PaymentStatus.Success, OrderStatus.WaitingMaterials);
        var repository = RepositoryFor(order);
        var logic = CreateLogic(repository.Object);

        await logic.HandleSepayWebhookAsync(Payload(order.OrderCode, 100_000));

        repository.Verify(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        Assert.Equal(PaymentStatus.Success, order.Payments.Single().PaymentStatus);
        Assert.Equal(OrderStatus.WaitingMaterials, order.OrderStatus);
    }

    [Fact]
    public async Task Webhook_WithAmountMismatch_DoesNotMutatePayment()
    {
        var order = TransferOrder(PaymentStatus.Pending, OrderStatus.PendingPayment);
        var repository = RepositoryFor(order);
        var logic = CreateLogic(repository.Object);

        await logic.HandleSepayWebhookAsync(Payload(order.OrderCode, 90_000));

        repository.Verify(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        Assert.Equal(PaymentStatus.Pending, order.Payments.Single().PaymentStatus);
        Assert.Null(order.Payments.Single().TransactionRef);
    }

    [Fact]
    public async Task Webhook_WithWrongReceivingAccount_IsIgnored()
    {
        var order = TransferOrder(PaymentStatus.Pending, OrderStatus.PendingPayment);
        var repository = RepositoryFor(order);
        var logic = CreateLogic(repository.Object, validateAccount: true);
        var payload = Payload(order.OrderCode, 100_000) with { AccountNumber = "999999999" };

        await logic.HandleSepayWebhookAsync(payload);

        repository.Verify(item => item.GetByCodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        repository.Verify(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Webhook_Content_NormalizesOrderReference()
    {
        var repository = new Mock<IOrderRepository>();
        repository
            .Setup(item => item.GetByCodeAsync("HVT-260819-010", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Order?)null);
        var logic = CreateLogic(repository.Object);
        var payload = Payload(null, 100_000) with
        {
            Code = null,
            Content = "Thanh toan HVT260819010"
        };

        await logic.HandleSepayWebhookAsync(payload);

        repository.Verify(
            item => item.GetByCodeAsync("HVT-260819-010", It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task RefreshExpiredQr_IssuesNewExpiryAndKeepsExpectedAmount()
    {
        var order = TransferOrder(PaymentStatus.Pending, OrderStatus.PendingPayment);
        order.Payments.Single().TransferQrExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
        var repository = RepositoryFor(order);
        var logic = CreateLogic(repository.Object);

        var response = await logic.RefreshTransferQrForOrderAsync(
            order.Id,
            new OrderAccessContext(Guid.NewGuid(), CanViewAllOrders: true));

        Assert.False(response.IsExpired);
        Assert.Equal(order.OrderCode, response.TransferContent);
        Assert.Contains("amount=100000", response.QrImageUrl);
        repository.Verify(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    private static PosTransferPaymentLogic CreateLogic(
        IOrderRepository repository,
        bool validateAccount = false)
    {
        var posOptions = Microsoft.Extensions.Options.Options.Create(new PosTransferPaymentOptions
        {
            BankCode = "TEST",
            BankBin = "970418",
            BankName = "Test Bank",
            AccountNumber = "123456789",
            AccountHolder = "HUONG VAN TRA",
            Template = "compact2"
        });
        var sepayOptions = Microsoft.Extensions.Options.Options.Create(new SepayOptions
        {
            EnableWebhook = true,
            ValidateAccountNumber = validateAccount,
            AccountNumber = "123456789",
            AmountToleranceVnd = 0,
            PosVaDurationSeconds = 300
        });

        return new PosTransferPaymentLogic(
            posOptions,
            sepayOptions,
            repository,
            null!,
            PosShiftTestDoubles.ShiftGuard(),
            Mock.Of<ILogger<PosTransferPaymentLogic>>());
    }

    private static Mock<IOrderRepository> RepositoryFor(Order order)
    {
        var repository = new Mock<IOrderRepository>();
        repository
            .Setup(item => item.GetByCodeAsync(order.OrderCode, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        repository
            .Setup(item => item.GetByIdAsync(order.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        repository
            .Setup(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        return repository;
    }

    private static Order TransferOrder(PaymentStatus paymentStatus, OrderStatus orderStatus)
    {
        var orderId = Guid.NewGuid();
        return new Order
        {
            Id = orderId,
            OrderCode = "HVT-260819-010",
            OrderChannel = OrderChannel.POS,
            OrderStatus = orderStatus,
            FinalAmount = 100_000,
            CreatedAt = DateTime.UtcNow.AddMinutes(-10),
            Payments =
            [
                new Payment
                {
                    Id = Guid.NewGuid(),
                    OrderId = orderId,
                    PaymentMethod = PaymentMethod.VietQR,
                    PaymentStatus = paymentStatus,
                    PaymentPurpose = PaymentPurpose.Full,
                    Amount = 100_000
                }
            ]
        };
    }

    private static SepayWebhookPayload Payload(string? orderCode, long amount) => new(
        Id: 12345,
        Gateway: "TEST",
        TransactionDate: "2026-08-25 12:00:00",
        AccountNumber: "123456789",
        SubAccount: null,
        Code: orderCode,
        Content: orderCode,
        TransferType: "in",
        Description: "SePay regression",
        TransferAmount: amount,
        Accumulated: 0,
        ReferenceCode: "TX-12345");
}
