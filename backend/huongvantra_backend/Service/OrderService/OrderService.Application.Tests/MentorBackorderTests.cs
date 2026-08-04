using Microsoft.Extensions.Options;
using Moq;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Application.Tests.TestSupport;
using OrderService.Application.UseCases;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;
using Xunit;

namespace OrderService.Application.Tests;

public sealed class MentorBackorderTests
{
    private static readonly Guid SkuId = Guid.Parse("bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb");

    [Fact]
    public async Task BackorderRequired_ReturnsSignalWithoutSavingOrder()
    {
        var repository = new Mock<IOrderRepository>();
        var inventory = new Mock<IInventoryCatalogClient>();
        inventory
            .Setup(client => client.PreparePosStockDeductionAsync(
                It.Is<InventoryStockHandlingRequest>(request => request.PreviewOnly),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((InventoryStockHandlingRequest request, CancellationToken _) =>
                BackorderResponse(request, required: true));
        var logic = CreateLogic(repository, inventory);

        await Assert.ThrowsAsync<BackorderConfirmationRequiredException>(() =>
            logic.CreateAsync(CreateRequest(), ManagerAccess()));

        repository.Verify(
            item => item.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()),
            Times.Never);
        repository.Verify(
            item => item.SaveChangesAsync(It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task AcceptBackorder_SavesOrderWithWaitingMaterialsStatus()
    {
        Order? persisted = null;
        var repository = new Mock<IOrderRepository>();
        repository
            .Setup(item => item.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
            .Callback<Order, CancellationToken>((order, _) => persisted = order)
            .Returns(Task.CompletedTask);
        repository
            .Setup(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var inventory = new Mock<IInventoryCatalogClient>();
        inventory
            .Setup(client => client.PreparePosStockDeductionAsync(
                It.IsAny<InventoryStockHandlingRequest>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((InventoryStockHandlingRequest request, CancellationToken _) =>
                BackorderResponse(request, required: false));
        var logic = CreateLogic(repository, inventory);

        var result = await logic.CreateAsync(
            CreateRequest() with
            {
                AcceptBackorder = true,
                FulfillmentPreference = FulfillmentPreference.PartialDelivery
            },
            ManagerAccess());

        Assert.NotNull(persisted);
        Assert.Equal(OrderStatus.WaitingMaterials, persisted!.OrderStatus);
        Assert.Equal("WaitingMaterials", result.OrderStatus);
        Assert.Equal("PendingReconciliation", result.InventorySyncStatus);
        Assert.NotNull(result.BackorderAcceptedAt);
        var line = Assert.Single(result.Items);
        Assert.Equal(1, line.ImmediateFulfilledQuantity);
        Assert.Equal(1, line.BackorderQuantity);
        Assert.Equal(PaymentStatus.Success, Assert.Single(persisted.Payments).PaymentStatus);
    }

    [Fact]
    public async Task PendingQr_StockChangedToBackorder_DoesNotRecordPaymentOrCompleteOrder()
    {
        var order = WaitingOrder();
        order.OrderStatus = OrderStatus.PendingPayment;
        order.BackorderAcceptedAt = null;
        order.FinalAmount = 100_000;
        order.Payments =
        [
            new Payment
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                PaymentMethod = PaymentMethod.VietQR,
                PaymentStatus = PaymentStatus.Pending,
                Amount = 100_000,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        ];
        var repository = new Mock<IOrderRepository>();
        repository.Setup(item => item.GetByIdAsync(order.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        var inventory = new Mock<IInventoryCatalogClient>();
        inventory
            .Setup(client => client.PreparePosStockDeductionAsync(
                It.Is<InventoryStockHandlingRequest>(request => request.PreviewOnly),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((InventoryStockHandlingRequest request, CancellationToken _) =>
                BackorderResponse(request, required: true));
        var logic = CreateLogic(repository, inventory);

        await Assert.ThrowsAsync<OrderValidationException>(() =>
            logic.CompleteAsync(
                order.Id,
                ManagerAccess(),
                actualReceivedAmount: 100_000));

        Assert.Equal(OrderStatus.PendingPayment, order.OrderStatus);
        Assert.Equal(PaymentStatus.Pending, Assert.Single(order.Payments).PaymentStatus);
        repository.Verify(item => item.TryTransitionStatusAsync(
            It.IsAny<Guid>(),
            It.IsAny<OrderStatus>(),
            It.IsAny<OrderStatus>(),
            It.IsAny<CancellationToken>()), Times.Never);
        repository.Verify(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AcceptedBackorderQr_RecordsPaymentAndRemainsWaitingMaterials()
    {
        var order = WaitingOrder();
        order.OrderStatus = OrderStatus.PendingPayment;
        order.BackorderAcceptedAt = DateTime.UtcNow;
        order.BackorderMinLeadDaysSnapshot = 3;
        order.BackorderMaxLeadDaysSnapshot = 5;
        order.FulfillmentPreference = FulfillmentPreference.PartialDelivery;
        order.FinalAmount = 100_000;
        order.Payments =
        [
            new Payment
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                PaymentMethod = PaymentMethod.VietQR,
                PaymentStatus = PaymentStatus.Pending,
                Amount = 100_000,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        ];
        var repository = new Mock<IOrderRepository>();
        repository.Setup(item => item.GetByIdAsync(order.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        repository.Setup(item => item.TryTransitionStatusAsync(
                order.Id,
                OrderStatus.PendingPayment,
                OrderStatus.WaitingMaterials,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        repository.Setup(item => item.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        var inventory = new Mock<IInventoryCatalogClient>();
        inventory
            .Setup(client => client.PreparePosStockDeductionAsync(
                It.IsAny<InventoryStockHandlingRequest>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((InventoryStockHandlingRequest request, CancellationToken _) =>
                BackorderResponse(request, required: false));
        var logic = CreateLogic(repository, inventory);

        await logic.CompleteAsync(
            order.Id,
            ManagerAccess(),
            actualReceivedAmount: 100_000);

        Assert.Equal(OrderStatus.WaitingMaterials, order.OrderStatus);
        Assert.Equal(InventorySyncStatus.PendingReconciliation, order.InventorySyncStatus);
        Assert.Equal(PaymentStatus.Success, Assert.Single(order.Payments).PaymentStatus);
        inventory.Verify(client => client.PreparePosStockDeductionAsync(
            It.Is<InventoryStockHandlingRequest>(request => request.PreviewOnly && request.AcceptBackorder),
            It.IsAny<CancellationToken>()), Times.Once);
        inventory.Verify(client => client.PreparePosStockDeductionAsync(
            It.Is<InventoryStockHandlingRequest>(request => !request.PreviewOnly && request.AcceptBackorder),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task WaitingMaterials_OrderCanBeCancelled_WhenNoPaymentWasCollected()
    {
        var order = WaitingOrder();
        var repository = new Mock<IOrderRepository>();
        repository.Setup(item => item.GetByIdAsync(order.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        repository.Setup(item => item.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        var logic = CreateLogic(repository, new Mock<IInventoryCatalogClient>());

        await logic.CancelAsync(order.Id, ManagerAccess(), "Khách đổi ý");

        Assert.Equal(OrderStatus.Cancelled, order.OrderStatus);
        Assert.Equal(InventorySyncStatus.Cancelled, order.InventorySyncStatus);
    }

    [Fact]
    public async Task WaitingMaterials_OrderCannotBeModified()
    {
        var order = WaitingOrder();
        var repository = new Mock<IOrderRepository>();
        repository.Setup(item => item.GetByIdAsync(order.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        var logic = CreateLogic(repository, new Mock<IInventoryCatalogClient>());

        await Assert.ThrowsAsync<OrderCannotBeModifiedException>(() =>
            logic.UpdateAsync(
                order.Id,
                new UpdateOrderRequest(null, null, 0),
            ManagerAccess()));
    }

    [Fact]
    public async Task PaidWaitingMaterials_RequiresApprovalAndRefundEvidenceBeforeCancellation()
    {
        var order = WaitingOrder();
        order.FulfillmentPreference = FulfillmentPreference.PartialDelivery;
        var deliveredLine = Assert.Single(order.OrderDetails);
        deliveredLine.Quantity = 2;
        deliveredLine.ImmediateFulfilledQuantity = 1;
        deliveredLine.BackorderQuantity = 1;
        order.FinalAmount = 100_000;
        order.Payments =
        [
            new Payment
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                PaymentMethod = PaymentMethod.BankTransfer,
                PaymentStatus = PaymentStatus.Success,
                Amount = 100_000,
                PaidAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        ];
        var repository = new Mock<IOrderRepository>();
        repository.Setup(item => item.GetByIdAsync(order.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        repository.Setup(item => item.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        var logic = CreateLogic(repository, new Mock<IInventoryCatalogClient>());
        var access = ManagerAccess();

        await Assert.ThrowsAsync<OrderValidationException>(() =>
            logic.CancelAsync(order.Id, access, "Khách đổi ý"));

        await logic.RequestBackorderCancellationAsync(
            order.Id, access, "Khách đổi ý", Guid.NewGuid(), "Sale POS");
        Assert.Equal(OrderStatus.CancellationRequested, order.OrderStatus);
        Assert.Equal(BackorderRefundStatus.PendingApproval, order.RefundStatus);

        await logic.ReviewBackorderCancellationAsync(
            order.Id,
            new ReviewBackorderCancellationRequest(true, "Đủ điều kiện hoàn"),
            access,
            Guid.NewGuid(),
            "Manager");
        Assert.Equal(BackorderRefundStatus.Approved, order.RefundStatus);

        await Assert.ThrowsAsync<OrderValidationException>(() =>
            logic.CompleteBackorderRefundAsync(
                order.Id,
                new CompleteBackorderRefundRequest("Chuyển khoản", "REF-CHUA-THU-HOI"),
                access,
                Guid.NewGuid(),
                "Accountant"));

        await logic.CompleteBackorderRefundAsync(
            order.Id,
            new CompleteBackorderRefundRequest(
                "Chuyển khoản",
                "REF-20260804-001",
                ImmediateItemsReturned: true),
            access,
            Guid.NewGuid(),
            "Accountant");
        Assert.Equal(OrderStatus.Cancelled, order.OrderStatus);
        Assert.Equal(BackorderRefundStatus.Completed, order.RefundStatus);
        Assert.Equal(PaymentStatus.Refunded, Assert.Single(order.Payments).PaymentStatus);
        Assert.Equal("REF-20260804-001", order.RefundEvidence);
    }

    [Theory]
    [InlineData(null, OrderStatus.Completed)]
    [InlineData("12 Nguyễn Trãi", OrderStatus.Processing)]
    public async Task InventoryConfirmation_TransitionsPickupOrDeliveryCorrectly(
        string? shippingAddress,
        OrderStatus expectedStatus)
    {
        var order = WaitingOrder();
        order.ShippingAddress = shippingAddress;
        var repository = new Mock<IOrderRepository>();
        repository.Setup(item => item.GetByIdAsync(order.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        repository.Setup(item => item.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        var logic = CreateLogic(repository, new Mock<IInventoryCatalogClient>());

        await logic.MarkInventorySyncedAsync(order.Id);

        Assert.Equal(expectedStatus, order.OrderStatus);
        Assert.Equal(InventorySyncStatus.Synced, order.InventorySyncStatus);
    }

    private static OrderLogic CreateLogic(
        Mock<IOrderRepository> repository,
        Mock<IInventoryCatalogClient> inventory)
    {
        var productCatalog = new Mock<IProductCatalogClient>();
        productCatalog
            .Setup(client => client.GetSkuProfilesAsync(
                It.IsAny<IEnumerable<Guid>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                new ProductSkuCatalogProfile(
                    SkuId, null, "Piece", "THANH_PHAM",
                    true, false, false, true, 0m)
            ]);

        var codeGenerator = new Mock<IOrderCodeGenerator>();
        codeGenerator
            .Setup(item => item.GenerateAsync(It.IsAny<OrderKind>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("BACKORDER-0001");

        var promotionLogic = new PromotionLogic(
            new Mock<IPromotionRepository>().Object,
            new Mock<ICustomerCatalogClient>().Object);
        var shiftGuard = PosShiftTestDoubles.ShiftGuard();

        return new OrderLogic(
            repository.Object,
            new Mock<IReturnOrderRepository>().Object,
            new Mock<IPaymentRepository>().Object,
            codeGenerator.Object,
            new Mock<IOrderEventPublisher>().Object,
            new Mock<IOrderActivityRepository>().Object,
            promotionLogic,
            productCatalog.Object,
            new Mock<ICustomerCatalogClient>().Object,
            new Mock<IContractCatalogClient>().Object,
            inventory.Object,
            new Mock<ICustomBundleRepository>().Object,
            new Mock<IEmailService>().Object,
            PosShiftTestDoubles.CashSessionLogic(shiftGuard),
            shiftGuard,
            Microsoft.Extensions.Options.Options.Create(new SepayOptions()),
            Microsoft.Extensions.Options.Options.Create(new BackorderOptions()));
    }

    private static InventoryStockHandlingResponse BackorderResponse(
        InventoryStockHandlingRequest request,
        bool required) =>
        new(
            request.OrderId,
            request.OrderCode,
            required ? "BackorderRequired" : "BackorderAccepted",
            HasPendingStockReconciliation: !required,
            required
                ? "Sản phẩm tạm hết hàng, dự kiến có sau 3-5 ngày."
                : "Đã ghi nhận đơn chờ nguyên liệu.",
            required ? [] : [Guid.NewGuid()],
            [new InventoryStockHandlingLineResponse(SkuId, "TEST-BO", "Trà test", 2, 1, 1)],
            BackorderRequired: required,
            BackorderMessage: required ? "Sản phẩm tạm hết hàng, dự kiến có sau 3-5 ngày." : null);

    private static CreateOrderRequest CreateRequest() =>
        new(
            CustomerId: null,
            CustomerSnapshotName: "Khách lẻ",
            EmployeeId: null,
            OrderChannel: OrderChannel.POS,
            ShippingAddress: null,
            Note: null,
            DiscountAmount: 0,
            Items:
            [
                new CreateOrderDetailRequest(
                    SkuId,
                    "Trà test",
                    "TEST-BO",
                    "Trà",
                    Quantity: 2,
                    CostPrice: 0,
                    UnitPrice: 50_000)
            ],
            PaymentMethod: PaymentMethod.Cash,
            PaidAmount: 100_000);

    private static Order WaitingOrder() => new()
    {
        Id = Guid.NewGuid(),
        OrderCode = "BACKORDER-WAITING",
        OrderChannel = OrderChannel.POS,
        OrderStatus = OrderStatus.WaitingMaterials,
        InventorySyncStatus = InventorySyncStatus.PendingReconciliation,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
        OrderDetails =
        [
            new OrderDetail
            {
                Id = Guid.NewGuid(),
                SkuId = SkuId,
                SkuSnapshotName = "Trà test",
                Quantity = 1,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        ],
        Payments = []
    };

    private static OrderAccessContext ManagerAccess() =>
        new(Guid.NewGuid(), CanViewAllOrders: true);
}
