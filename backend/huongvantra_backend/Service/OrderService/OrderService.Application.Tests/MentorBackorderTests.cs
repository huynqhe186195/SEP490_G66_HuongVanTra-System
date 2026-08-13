using Microsoft.Extensions.Options;
using Moq;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Application.Tests.TestSupport;
using OrderService.Application.Services;
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
    public async Task CustomOnly_MaterialsShortage_RequiresBackorderWithoutSaving()
    {
        var materialSkuId = Guid.Parse("cccccccc-3333-4333-8333-cccccccccccc");
        var repository = new Mock<IOrderRepository>();
        var inventory = new Mock<IInventoryCatalogClient>();
        inventory
            .Setup(client => client.PrepareCustomMaterialsAsync(
                It.Is<InventoryCustomMaterialsRequest>(request => request.PreviewOnly),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((InventoryCustomMaterialsRequest request, CancellationToken _) =>
                new InventoryStockHandlingResponse(
                    request.OrderId,
                    request.OrderCode,
                    "BackorderRequired",
                    false,
                    "Sản phẩm tạm hết hàng, dự kiến có sau 3-5 ngày.",
                    [],
                    [new InventoryStockHandlingLineResponse(materialSkuId, "NL-X", "NL test", 2, 0, 2)],
                    BackorderRequired: true,
                    BackorderMessage: "Sản phẩm tạm hết hàng, dự kiến có sau 3-5 ngày."));

        var logic = CreateLogicWithCustomMaterial(repository, inventory, materialSkuId);

        await Assert.ThrowsAsync<BackorderConfirmationRequiredException>(() =>
            logic.CreateAsync(CreateCustomOnlyRequest(materialSkuId), ManagerAccess()));

        repository.Verify(
            item => item.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task CustomOnly_AcceptBackorder_SavesWaitingMaterials()
    {
        var materialSkuId = Guid.Parse("cccccccc-3333-4333-8333-cccccccccccc");
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
            .Setup(client => client.PrepareCustomMaterialsAsync(
                It.IsAny<InventoryCustomMaterialsRequest>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((InventoryCustomMaterialsRequest request, CancellationToken _) =>
                new InventoryStockHandlingResponse(
                    request.OrderId,
                    request.OrderCode,
                    request.AcceptBackorder ? "BackorderAccepted" : "BackorderRequired",
                    false,
                    request.AcceptBackorder
                        ? "Đã ghi nhận đơn chờ nguyên liệu custom."
                        : "Sản phẩm tạm hết hàng, dự kiến có sau 3-5 ngày.",
                    [],
                    [new InventoryStockHandlingLineResponse(materialSkuId, "NL-X", "NL test", 2, 0, 2)],
                    BackorderRequired: !request.AcceptBackorder,
                    BackorderMessage: request.AcceptBackorder
                        ? null
                        : "Sản phẩm tạm hết hàng, dự kiến có sau 3-5 ngày."));

        var logic = CreateLogicWithCustomMaterial(repository, inventory, materialSkuId);
        var request = CreateCustomOnlyRequest(materialSkuId) with
        {
            AcceptBackorder = true,
            DepositAmount = 50_000,
            PickupDate = DateTime.UtcNow.Date.AddDays(3),
            FulfillmentPreference = FulfillmentPreference.CompleteDelivery
        };

        var result = await logic.CreateAsync(request, ManagerAccess());

        Assert.NotNull(persisted);
        Assert.Equal(OrderStatus.WaitingMaterials, persisted!.OrderStatus);
        Assert.Equal(OrderStatus.WaitingMaterials.ToString(), result.OrderStatus);
        Assert.NotNull(persisted.BackorderAcceptedAt);
        inventory.Verify(
            client => client.PrepareCustomMaterialsAsync(
                It.Is<InventoryCustomMaterialsRequest>(r => r.AcceptBackorder && !r.PreviewOnly),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task PackCustomBundle_AllPacked_AdvancesWaitingMaterialsToReadyToDeliver()
    {
        var materialSkuId = Guid.Parse("cccccccc-3333-4333-8333-cccccccccccc");
        var orderId = Guid.NewGuid();
        var bundleId = Guid.NewGuid();
        var order = new Order
        {
            Id = orderId,
            OrderCode = "HVT-PACK-001",
            OrderChannel = OrderChannel.POS,
            OrderKind = OrderKind.Sale,
            OrderStatus = OrderStatus.WaitingMaterials,
            InventorySyncStatus = InventorySyncStatus.Synced,
            FinalAmount = 100_000,
            DepositAmount = 50_000,
            BackorderAcceptedAt = DateTime.UtcNow,
            ShippingAddress = null,
            OrderDetails = [],
            CustomBundles =
            [
                new CustomBundle
                {
                    Id = bundleId,
                    OrderId = orderId,
                    Label = "Gói test",
                    PackingStatus = PackingStatus.Pending,
                    TotalPrice = 100_000,
                    Ingredients =
                    [
                        new CustomBundleIngredient
                        {
                            Id = Guid.NewGuid(),
                            MaterialSkuId = materialSkuId,
                            MaterialSkuCode = "NL-X",
                            MaterialSnapshotName = "NL test",
                            Quantity = 2,
                            UnitPrice = 50_000,
                            SubTotal = 100_000
                        }
                    ]
                }
            ]
        };
        order.CustomBundles.First().Order = order;

        var orderRepo = new Mock<IOrderRepository>();
        orderRepo.Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>())).ReturnsAsync(order);
        orderRepo.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var bundleRepo = new Mock<ICustomBundleRepository>();
        bundleRepo
            .Setup(r => r.GetByIdAsync(bundleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order.CustomBundles.First());
        bundleRepo.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var inventory = new Mock<IInventoryCatalogClient>();
        inventory
            .Setup(c => c.DeductMaterialsAsync(
                It.IsAny<IEnumerable<(Guid, string?, string?, int)>>(),
                It.IsAny<string?>(),
                It.IsAny<Guid?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var productCatalog = new Mock<IProductCatalogClient>();
        productCatalog
            .Setup(client => client.GetSkuProfilesAsync(
                It.IsAny<IEnumerable<Guid>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                new ProductSkuCatalogProfile(
                    materialSkuId, null, "Piece", "NGUYEN_LIEU",
                    true, true, true, false, 0m)
            ]);

        var activityRepo = new Mock<IOrderActivityRepository>();
        activityRepo
            .Setup(r => r.AddAsync(It.IsAny<OrderActivity>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var shiftGuard = PosShiftTestDoubles.ShiftGuard();
        var logic = new OrderLogic(
            orderRepo.Object,
            new Mock<IReturnOrderRepository>().Object,
            new Mock<IPaymentRepository>().Object,
            new Mock<IOrderCodeGenerator>().Object,
            new Mock<IOrderEventPublisher>().Object,
            activityRepo.Object,
            new PromotionLogic(
                new Mock<IPromotionRepository>().Object,
                new Mock<ICustomerCatalogClient>().Object),
            productCatalog.Object,
            new Mock<ICustomerCatalogClient>().Object,
            new Mock<IContractCatalogClient>().Object,
            inventory.Object,
            bundleRepo.Object,
            new Mock<IEmailService>().Object,
            PosShiftTestDoubles.CashSessionLogic(shiftGuard),
            shiftGuard,
            new PaymentIdempotencyService(
                Mock.Of<IPaymentIdempotencyRepository>(),
                Mock.Of<Microsoft.Extensions.Logging.ILogger<PaymentIdempotencyService>>()),
            Microsoft.Extensions.Options.Options.Create(new SepayOptions()),
            Microsoft.Extensions.Options.Options.Create(new BackorderOptions()));

        var result = await logic.PackCustomBundleAsync(bundleId);

        Assert.Equal(PackingStatus.Packed.ToString(), result.PackingStatus);
        Assert.Equal(OrderStatus.ReadyToDeliver, order.OrderStatus);
        orderRepo.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
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
    // POS-06 (KB4): nhận tại quầy thì khách đã về, chỉ sẵn sàng giao — chờ Sale bấm "Đã giao hàng".
    [InlineData(null, OrderStatus.ReadyToDeliver)]
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

    [Fact]
    public async Task AcceptBackorder_WithDeposit_StoresDepositAmount_TagsPaymentAsDeposit()
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

        // Đơn 100.000đ, khách cọc 60.000đ (60%).
        var result = await logic.CreateAsync(
            CreateRequest() with
            {
                AcceptBackorder = true,
                FulfillmentPreference = FulfillmentPreference.PartialDelivery,
                PaidAmount = 60_000,
                DepositAmount = 60_000
            },
            ManagerAccess());

        Assert.NotNull(persisted);
        Assert.Equal(60_000m, persisted!.DepositAmount);
        Assert.Equal(60_000m, result.DepositAmount);
        Assert.Equal(40_000m, result.RemainingAmountDue);
        var payment = Assert.Single(persisted.Payments);
        Assert.Equal(PaymentPurpose.Deposit, payment.PaymentPurpose);
        Assert.Equal(60_000m, payment.Amount);
        Assert.Equal(PaymentStatus.Success, payment.PaymentStatus);
    }

    [Fact]
    public async Task AcceptBackorder_DepositBelowHalf_Throws()
    {
        var repository = new Mock<IOrderRepository>();
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

        // Đơn 100.000đ, khách chỉ cọc 40.000đ (40%) — dưới mức tối thiểu 50%.
        await Assert.ThrowsAsync<OrderValidationException>(() =>
            logic.CreateAsync(
                CreateRequest() with
                {
                    AcceptBackorder = true,
                    FulfillmentPreference = FulfillmentPreference.PartialDelivery,
                    PaidAmount = 40_000,
                    DepositAmount = 40_000
                },
                ManagerAccess()));

        repository.Verify(
            item => item.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task DepositOrder_Cancel_DoesNotRequireRefundApproval_DepositKept()
    {
        var order = DepositOrder();
        var repository = new Mock<IOrderRepository>();
        repository.Setup(item => item.GetByIdAsync(order.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        repository.Setup(item => item.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        var logic = CreateLogic(repository, new Mock<IInventoryCatalogClient>());

        await logic.CancelAsync(order.Id, ManagerAccess(), "Khách đổi ý");

        Assert.Equal(OrderStatus.Cancelled, order.OrderStatus);
        Assert.Equal(InventorySyncStatus.Cancelled, order.InventorySyncStatus);
        Assert.Equal(BackorderRefundStatus.NotRequired, order.RefundStatus);
        Assert.Null(order.RefundAmount);
        // Tiền cọc đã vào két — không đảo trạng thái thanh toán.
        Assert.Equal(PaymentStatus.Success, Assert.Single(order.Payments).PaymentStatus);
    }

    [Fact]
    public async Task CancelOverdueDeposit_Before7Days_Throws()
    {
        var order = DepositOrder();
        order.PickupDate = DateTime.UtcNow.Date.AddDays(-3);
        var repository = new Mock<IOrderRepository>();
        repository.Setup(item => item.GetByIdAsync(order.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        var logic = CreateLogic(repository, new Mock<IInventoryCatalogClient>());

        await Assert.ThrowsAsync<OrderValidationException>(() =>
            logic.CancelOverdueDepositAsync(order.Id, ManagerAccess(), "Khách không đến lấy"));

        Assert.Equal(OrderStatus.WaitingMaterials, order.OrderStatus);
        repository.Verify(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CancelOverdueDeposit_After7Days_CancelsAndKeepsDeposit()
    {
        var order = DepositOrder();
        order.PickupDate = DateTime.UtcNow.Date.AddDays(-8);
        var repository = new Mock<IOrderRepository>();
        repository.Setup(item => item.GetByIdAsync(order.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        repository.Setup(item => item.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        var logic = CreateLogic(repository, new Mock<IInventoryCatalogClient>());

        var result = await logic.CancelOverdueDepositAsync(
            order.Id, ManagerAccess(), "Quá hạn nhận hàng", Guid.NewGuid(), "Manager");

        Assert.Equal(OrderStatus.Cancelled, order.OrderStatus);
        Assert.Equal(InventorySyncStatus.Cancelled, order.InventorySyncStatus);
        Assert.Equal(BackorderRefundStatus.NotRequired, order.RefundStatus);
        Assert.Null(order.RefundAmount);
        Assert.Equal(60_000m, result.DepositAmount);
        Assert.Equal(PaymentStatus.Success, Assert.Single(order.Payments).PaymentStatus);
    }

    [Fact]
    public async Task CancelOverdueDeposit_NonManager_Throws()
    {
        var order = DepositOrder();
        order.PickupDate = DateTime.UtcNow.Date.AddDays(-8);
        var repository = new Mock<IOrderRepository>();
        repository.Setup(item => item.GetByIdAsync(order.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        var logic = CreateLogic(repository, new Mock<IInventoryCatalogClient>());

        await Assert.ThrowsAsync<OrderForbiddenException>(() =>
            logic.CancelOverdueDepositAsync(
                order.Id,
                new OrderAccessContext(Guid.NewGuid(), CanViewAllOrders: false),
                "Quá hạn nhận hàng"));

        Assert.Equal(OrderStatus.WaitingMaterials, order.OrderStatus);
    }

    [Fact]
    public async Task CollectRemainingAndDeliver_CompletesOrder_WithTwoPaymentRecords()
    {
        var order = DepositOrder();
        order.OrderStatus = OrderStatus.ReadyToDeliver;
        var repository = new Mock<IOrderRepository>();
        repository.Setup(item => item.GetByIdAsync(order.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        repository.Setup(item => item.TryTransitionStatusAsync(
                order.Id,
                OrderStatus.ReadyToDeliver,
                OrderStatus.Completed,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        repository.Setup(item => item.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var paymentRepository = new Mock<IPaymentRepository>();
        Payment? added = null;
        paymentRepository
            .Setup(item => item.AddAsync(It.IsAny<Payment>(), It.IsAny<CancellationToken>()))
            .Callback<Payment, CancellationToken>((payment, _) => added = payment)
            .Returns(Task.CompletedTask);

        var logic = CreateLogic(repository, new Mock<IInventoryCatalogClient>(), paymentRepository);

        var result = await logic.CollectRemainingAndDeliverAsync(
            order.Id,
            new CollectRemainingRequest(PaymentMethod.Cash, 40_000),
            ManagerAccess(),
            Guid.NewGuid(),
            "Sale POS");

        Assert.Equal(OrderStatus.Completed, order.OrderStatus);
        Assert.NotNull(added);
        Assert.Equal(PaymentPurpose.RemainingAtPickup, added!.PaymentPurpose);
        Assert.Equal(40_000m, added.Amount);
        Assert.Equal(PaymentStatus.Success, added.PaymentStatus);
        Assert.Equal(2, order.Payments!.Count);
        Assert.Equal(
            [PaymentPurpose.Deposit, PaymentPurpose.RemainingAtPickup],
            order.Payments.Select(payment => payment.PaymentPurpose));
        Assert.Equal(0m, result.RemainingAmountDue);
    }

    [Fact]
    public async Task CollectRemainingAndDeliver_AmountBelowRemaining_Throws()
    {
        var order = DepositOrder();
        order.OrderStatus = OrderStatus.ReadyToDeliver;
        var repository = new Mock<IOrderRepository>();
        repository.Setup(item => item.GetByIdAsync(order.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        var paymentRepository = new Mock<IPaymentRepository>();
        var logic = CreateLogic(repository, new Mock<IInventoryCatalogClient>(), paymentRepository);

        await Assert.ThrowsAsync<OrderValidationException>(() =>
            logic.CollectRemainingAndDeliverAsync(
                order.Id,
                new CollectRemainingRequest(PaymentMethod.Cash, 10_000),
                ManagerAccess()));

        Assert.Equal(OrderStatus.ReadyToDeliver, order.OrderStatus);
        paymentRepository.Verify(
            item => item.AddAsync(It.IsAny<Payment>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    private static OrderLogic CreateLogic(
        Mock<IOrderRepository> repository,
        Mock<IInventoryCatalogClient> inventory)
    {
        return CreateLogic(repository, inventory, new Mock<IPaymentRepository>());
    }

    private static OrderLogic CreateLogicWithCustomMaterial(
        Mock<IOrderRepository> repository,
        Mock<IInventoryCatalogClient> inventory,
        Guid materialSkuId)
    {
        var productCatalog = new Mock<IProductCatalogClient>();
        productCatalog
            .Setup(client => client.GetSkuProfilesAsync(
                It.IsAny<IEnumerable<Guid>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                new ProductSkuCatalogProfile(
                    materialSkuId, null, "Piece", "NGUYEN_LIEU",
                    true, true, true, false, 0m)
            ]);

        var codeGenerator = new Mock<IOrderCodeGenerator>();
        codeGenerator
            .Setup(item => item.GenerateAsync(It.IsAny<OrderKind>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("CUSTOM-BO-0001");

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
            new PaymentIdempotencyService(
                Mock.Of<IPaymentIdempotencyRepository>(),
                Mock.Of<Microsoft.Extensions.Logging.ILogger<PaymentIdempotencyService>>()),
            Microsoft.Extensions.Options.Options.Create(new SepayOptions()),
            Microsoft.Extensions.Options.Options.Create(new BackorderOptions()));
    }

    private static OrderLogic CreateLogic(
        Mock<IOrderRepository> repository,
        Mock<IInventoryCatalogClient> inventory,
        Mock<IPaymentRepository> paymentRepository)
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
            paymentRepository.Object,
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
            new PaymentIdempotencyService(
                Mock.Of<IPaymentIdempotencyRepository>(),
                Mock.Of<Microsoft.Extensions.Logging.ILogger<PaymentIdempotencyService>>()),
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
            PaidAmount: 100_000,
            // POS-06 (KB4): đơn backorder bắt buộc có người nhận để đối chiếu khi khách quay lại.
            PickupContactName: "Nguyễn Văn A",
            PickupContactPhone: "0900000000");

    private static CreateOrderRequest CreateCustomOnlyRequest(Guid materialSkuId) =>
        new(
            CustomerId: null,
            CustomerSnapshotName: "Khách lẻ",
            EmployeeId: null,
            OrderChannel: OrderChannel.POS,
            ShippingAddress: null,
            Note: null,
            DiscountAmount: 0,
            Items: [],
            PaymentMethod: PaymentMethod.Cash,
            PaidAmount: 100_000,
            CustomBundles:
            [
                new CreateCustomBundleRequest(
                    "Gói custom test",
                    null,
                    [
                        new CreateCustomBundleIngredientRequest(
                            materialSkuId,
                            "NL-X",
                            "NL test",
                            Quantity: 2,
                            UnitPrice: 50_000)
                    ])
            ],
            PickupContactName: "Nguyễn Văn A",
            PickupContactPhone: "0900000000");

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

    /// <summary>Đơn backorder đã thu cọc 60.000đ trên tổng 100.000đ.</summary>
    private static Order DepositOrder()
    {
        var order = WaitingOrder();
        order.FinalAmount = 100_000;
        order.TotalAmount = 100_000;
        order.DepositAmount = 60_000;
        order.PickupDate = DateTime.UtcNow.Date.AddDays(2);
        order.FulfillmentPreference = FulfillmentPreference.PartialDelivery;
        order.Payments =
        [
            new Payment
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                PaymentMethod = PaymentMethod.Cash,
                PaymentStatus = PaymentStatus.Success,
                PaymentPurpose = PaymentPurpose.Deposit,
                Amount = 60_000,
                PaidAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        ];
        return order;
    }

    private static OrderAccessContext ManagerAccess() =>
        new(Guid.NewGuid(), CanViewAllOrders: true);
}