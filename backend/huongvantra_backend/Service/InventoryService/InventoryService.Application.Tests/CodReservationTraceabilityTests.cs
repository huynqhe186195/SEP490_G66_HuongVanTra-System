using HuongVanTra.Shared.Messages;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.Interfaces;
using InventoryService.Application.Options;
using InventoryService.Application.UseCases;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using InventoryService.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace InventoryService.Application.Tests;

/// <summary>
/// POS-04 (truy vết giữ chỗ hai chiều) — kiểm chứng các bảo đảm:
/// tổng giữ chỗ Active theo SKU khớp <c>SkuStock.ReservedQuantity</c>;
/// chỉ dòng Active tính vào tổng đang giữ; hủy → Released và rời danh sách active;
/// xuất kho → Deducted và rời danh sách active; sự kiện trùng không tạo giữ chỗ trùng;
/// lịch sử vẫn tra cứu được sau khi Released/Deducted.
/// </summary>
public sealed class CodReservationTraceabilityTests
{
    private static InventoryDbContext NewContext() =>
        new(new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase($"inv-trace-{Guid.NewGuid():N}")
            .Options);

    private sealed class InMemorySkuStockRepository(InventoryDbContext db) : ISkuStockRepository
    {
        public Task<SkuStock?> GetBySkuIdAsync(Guid skuId, CancellationToken ct = default) =>
            db.SkuStocks.FirstOrDefaultAsync(s => s.SkuId == skuId, ct);

        public Task<SkuStock?> GetBySkuIdWithLockAsync(Guid skuId, CancellationToken ct = default) =>
            db.SkuStocks.FirstOrDefaultAsync(s => s.SkuId == skuId, ct);

        public Task<List<SkuStock>> GetAllAsync(CancellationToken ct = default) =>
            db.SkuStocks.OrderBy(s => s.SkuCode).ToListAsync(ct);

        public async Task AddAsync(SkuStock stock, CancellationToken ct = default) =>
            await db.SkuStocks.AddAsync(stock, ct);

        public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
            db.SaveChangesAsync(ct);
    }

    private sealed class PassThroughUnitOfWork : IInventoryUnitOfWork
    {
        public Task<T> ExecuteInTransactionAsync<T>(
            Func<CancellationToken, Task<T>> action, CancellationToken ct = default) => action(ct);
    }

    private static InventoryLogic BuildLogic(InventoryDbContext db, bool simulateWarehouse = true) =>
        new(
            new InMemorySkuStockRepository(db),
            new StockDeductQueueRepository(db),
            Mock.Of<IStockAdjustmentRequestRepository>(),
            new StockExportSlipRepository(db),
            Mock.Of<IStockImportSlipRepository>(),
            new WarehouseBatchRepository(db),
            new StockExportBatchAllocationRepository(db),
            new InventoryLedgerRepository(db),
            Mock.Of<ISupplierReceiptRepository>(),
            Mock.Of<ISupplierReturnRequestRepository>(),
            Mock.Of<IStocktakeRequestRepository>(),
            Mock.Of<IShelfReplenishmentSuggestionRepository>(),
            new ProcessedIntegrationEventRepository(db),
            Mock.Of<IInventoryEventPublisher>(),
            new PassThroughUnitOfWork(),
            Mock.Of<IProductionOrderRepository>(),
            Mock.Of<IStockTransferRepository>(),
            Mock.Of<IProductCatalogClient>(),
            Mock.Of<ISupplierRepository>(),
            Mock.Of<ISupplierProductRepository>(),
            Mock.Of<IReturnInspectionRepository>(),
            Mock.Of<HuongVanTra.Shared.Notifications.INotificationClient>(),
            Microsoft.Extensions.Options.Options.Create(
                new InventoryOptions { SimulateWarehouse = simulateWarehouse }));

    private static void SeedWarehouseBatch(
        InventoryDbContext db,
        Guid skuId,
        string skuCode,
        int quantity,
        string location = "Warehouse")
    {
        var batchId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        db.WarehouseBatches.Add(new WarehouseBatch
        {
            Id = batchId,
            LotCode = $"LOT-{skuCode}-{location}",
            BatchCode = $"LOT-{skuCode}-{location}",
            Location = location,
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now,
            Items =
            {
                new WarehouseBatchItem
                {
                    Id = Guid.NewGuid(),
                    WarehouseBatchId = batchId,
                    SkuId = skuId,
                    SkuCode = skuCode,
                    QuantityOnHand = quantity,
                    InitialQuantity = quantity,
                    CreatedAt = now,
                    UpdatedAt = now,
                },
            },
        });
    }

    private static async Task SeedStockAsync(
        InventoryDbContext db, Guid skuId, int onHand, string code = "SKU-1")
    {
        db.SkuStocks.Add(new SkuStock
        {
            SkuId = skuId,
            SkuCode = code,
            QuantityOnHand = onHand,
            ReservedQuantity = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }

    private static OrderPlacedEvent CodPlaced(
        Guid orderId, Guid skuId, int qty, string code = "HVT-T1", string customer = "Nguyễn Văn A") =>
        new()
        {
            EventId = Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = code,
            OrderStatus = "PendingPayment",
            OrderChannel = "COD",
            CustomerSnapshotName = customer,
            TotalAmount = qty * 10_000m,
            Items = new[] { new OrderItemEvent { SkuId = skuId, SkuCode = "SKU-1", Quantity = qty } }
        };

    [Fact]
    public async Task ActiveReservationsBySku_SumMatches_SkuStockReservedQuantity()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 30);
        var logic = BuildLogic(db);

        await logic.HandleOrderPlacedAsync(CodPlaced(Guid.NewGuid(), skuId, 4, "HVT-T1", "Khách A"));
        await logic.HandleOrderPlacedAsync(CodPlaced(Guid.NewGuid(), skuId, 7, "HVT-T2", "Khách B"));

        var summary = await logic.GetSkuCodReservationsAsync(skuId);

        Assert.Equal(2, summary.Orders.Count);
        Assert.Equal(11, summary.TotalActiveReservedQuantity);
        Assert.Equal(summary.SkuStockReservedQuantity, summary.TotalActiveReservedQuantity);
        Assert.All(summary.Orders, o =>
            Assert.Equal(nameof(StockReservationStatus.Active), o.ReservationStatus));
        Assert.Contains(summary.Orders, o => o.CustomerSnapshotName == "Khách A");
        Assert.Contains(summary.Orders, o => o.CustomerSnapshotName == "Khách B");
    }

    [Fact]
    public async Task OrderReservationLines_ExposeSnapshotAndReservedTimestamp()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 3));

        var detail = await logic.GetOrderCodReservationsAsync(orderId);

        Assert.True(detail.HasActiveReservation);
        Assert.Equal(3, detail.TotalActiveReservedQuantity);
        var line = Assert.Single(detail.Lines);
        Assert.Equal(skuId, line.SkuId);
        Assert.Equal(3, line.OrderedQuantity);
        Assert.Equal(3, line.ReservedQuantity);
        Assert.Equal(nameof(StockReservationStatus.Active), line.ReservationStatus);
        Assert.NotNull(line.ReservedAt);
        Assert.Null(line.ReleasedAt);
        Assert.Null(line.DeductedAt);
    }

    [Fact]
    public async Task Cancel_MarksReleased_RemovesFromActive_ButKeepsHistory()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 5));
        await logic.HandleOrderCancelledAsync(new OrderCancelledEvent
        {
            EventId = Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = "HVT-T1",
            Items = new[] { new OrderItemEvent { SkuId = skuId, Quantity = 5 } }
        });

        // Rời khỏi danh sách active theo SKU.
        var summary = await logic.GetSkuCodReservationsAsync(skuId);
        Assert.Empty(summary.Orders);
        Assert.Equal(0, summary.TotalActiveReservedQuantity);
        Assert.Equal(0, summary.SkuStockReservedQuantity);
        Assert.Equal(10, (await db.SkuStocks.SingleAsync(s => s.SkuId == skuId)).QuantityOnHand);

        // Nhưng lịch sử theo đơn vẫn tra cứu được.
        var detail = await logic.GetOrderCodReservationsAsync(orderId);
        Assert.False(detail.HasActiveReservation);
        Assert.Equal(0, detail.TotalActiveReservedQuantity);
        var line = Assert.Single(detail.Lines);
        Assert.Equal(nameof(StockReservationStatus.Released), line.ReservationStatus);
        Assert.NotNull(line.ReservedAt);
        Assert.NotNull(line.ReleasedAt);
        Assert.Null(line.DeductedAt);
    }

    [Fact]
    public async Task CancelledQueue_WithLeftoverReservation_ReleasesItOnCancellationRetry()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        var orderId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var stock = await db.SkuStocks.SingleAsync(s => s.SkuId == skuId);
        stock.ReservedQuantity = 4;
        db.StockDeductQueues.Add(new StockDeductQueue
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            OrderCode = "HVT-ORPHAN",
            QueueStatus = QueueStatus.Cancelled,
            IsReserved = true,
            CreatedAt = DateTime.UtcNow,
            Items =
            [
                new StockDeductQueueItem
                {
                    Id = Guid.NewGuid(),
                    SkuId = skuId,
                    SkuSnapshotName = "SKU-1",
                    Quantity = 4,
                    ReservedQuantity = 4,
                    ReservationStatus = StockReservationStatus.Active,
                    ReservedAt = DateTime.UtcNow,
                },
            ],
        });
        await db.SaveChangesAsync();
        var logic = BuildLogic(db);

        await logic.HandleOrderCancelledAsync(new OrderCancelledEvent
        {
            EventId = Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = "HVT-ORPHAN",
        });

        var releasedStock = await db.SkuStocks.AsNoTracking().SingleAsync(s => s.SkuId == skuId);
        var queue = await db.StockDeductQueues.Include(q => q.Items).SingleAsync(q => q.OrderId == orderId);
        Assert.Equal(0, releasedStock.ReservedQuantity);
        Assert.False(queue.IsReserved);
        Assert.Equal(StockReservationStatus.Released, Assert.Single(queue.Items).ReservationStatus);
    }

    [Fact]
    public async Task Shipping_MarksDeducted_RemovesFromActive_ButKeepsHistory()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 6));
        var queue = await db.StockDeductQueues.Include(q => q.Items).FirstAsync(q => q.OrderId == orderId);
        await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);

        var summary = await logic.GetSkuCodReservationsAsync(skuId);
        Assert.Empty(summary.Orders);
        Assert.Equal(0, summary.TotalActiveReservedQuantity);

        var detail = await logic.GetOrderCodReservationsAsync(orderId);
        Assert.False(detail.HasActiveReservation);
        var line = Assert.Single(detail.Lines);
        Assert.Equal(nameof(StockReservationStatus.Deducted), line.ReservationStatus);
        Assert.NotNull(line.DeductedAt);
        Assert.Null(line.ReleasedAt);
    }

    [Fact]
    public async Task DuplicateOrderPlaced_DoesNotCreateDuplicateReservationRows()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();
        var evt = CodPlaced(orderId, skuId, 4);

        await logic.HandleOrderPlacedAsync(evt);
        await logic.HandleOrderPlacedAsync(evt);

        var summary = await logic.GetSkuCodReservationsAsync(skuId);
        var order = Assert.Single(summary.Orders);
        Assert.Equal(4, order.ReservedQuantity);
        Assert.Equal(4, summary.TotalActiveReservedQuantity);
        Assert.Equal(summary.SkuStockReservedQuantity, summary.TotalActiveReservedQuantity);

        var detail = await logic.GetOrderCodReservationsAsync(orderId);
        Assert.Single(detail.Lines);
    }

    [Fact]
    public async Task ActiveOrderIds_FilterAndList_ReflectReservationLifecycle()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 30);
        var logic = BuildLogic(db);
        var keptOrderId = Guid.NewGuid();
        var cancelledOrderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(keptOrderId, skuId, 3, "HVT-KEEP"));
        await logic.HandleOrderPlacedAsync(CodPlaced(cancelledOrderId, skuId, 5, "HVT-CANCEL"));

        var beforeIds = await logic.GetOrderIdsWithActiveReservationAsync(
            new[] { keptOrderId, cancelledOrderId });
        Assert.Equal(2, beforeIds.Count);

        await logic.HandleOrderCancelledAsync(new OrderCancelledEvent
        {
            EventId = Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = cancelledOrderId,
            OrderCode = "HVT-CANCEL",
            Items = new[] { new OrderItemEvent { SkuId = skuId, Quantity = 5 } }
        });

        var afterIds = await logic.GetOrderIdsWithActiveReservationAsync(
            new[] { keptOrderId, cancelledOrderId });
        Assert.Equal(keptOrderId, Assert.Single(afterIds));

        var paged = await logic.GetOrdersWithActiveReservationAsync(search: null);
        var listed = Assert.Single(paged.Items);
        Assert.Equal(keptOrderId, listed.OrderId);
        Assert.Equal("HVT-KEEP", listed.OrderCode);
        Assert.Equal(3, listed.TotalActiveReservedQuantity);
        Assert.Equal(1, listed.ActiveReservedLineCount);
        Assert.NotNull(listed.ReservedAt);
    }

    [Fact]
    public async Task ReplaceReservation_RestampsActiveLines_AndKeepsSumConsistent()
    {
        await using var db = NewContext();
        var skuA = Guid.NewGuid();
        var skuB = Guid.NewGuid();
        await SeedStockAsync(db, skuA, onHand: 20, code: "SKU-A");
        await SeedStockAsync(db, skuB, onHand: 20, code: "SKU-B");
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuA, 3));
        await logic.ReplaceCodReservationAsync(new ReplaceCodReservationRequest(
            orderId,
            OperationId: Guid.NewGuid(),
            TotalAmount: 60_000m,
            Items: new List<ReplaceCodReservationItemRequest>
            {
                new(skuB, "SKU-B", "SKU-B", 6)
            }));

        var summaryA = await logic.GetSkuCodReservationsAsync(skuA);
        Assert.Empty(summaryA.Orders);
        Assert.Equal(0, summaryA.SkuStockReservedQuantity);

        var summaryB = await logic.GetSkuCodReservationsAsync(skuB);
        var orderB = Assert.Single(summaryB.Orders);
        Assert.Equal(6, orderB.ReservedQuantity);
        Assert.Equal(summaryB.SkuStockReservedQuantity, summaryB.TotalActiveReservedQuantity);

        var detail = await logic.GetOrderCodReservationsAsync(orderId);
        Assert.Equal(6, detail.TotalActiveReservedQuantity);
        var activeLine = Assert.Single(
            detail.Lines, l => l.ReservationStatus == nameof(StockReservationStatus.Active));
        Assert.Equal(skuB, activeLine.SkuId);
    }

    [Fact]
    public async Task CodReservation_ShelfInsufficient_WarehouseSufficient_ReservesShelfAndMarksWarehouseTransfer()
    {
        // Bug fix: COD yêu cầu 10, Kệ chỉ 3, Kho thành phẩm còn 15
        // → giữ chỗ 3 từ Kệ, đánh dấu 7 chờ điều chuyển Kho, queue Waiting (không phải Insufficient).
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        db.SkuStocks.Add(new SkuStock
        {
            SkuId = skuId,
            SkuCode = "SKU-1",
            QuantityOnHand = 3, // Kệ chỉ còn 3
            WarehouseQuantityOnHand = 15, // Kho còn 15
            ReservedQuantity = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 10));

        // Queue phải Waiting, không phải Insufficient.
        var queue = await db.StockDeductQueues.Include(q => q.Items).FirstAsync(q => q.OrderId == orderId);
        Assert.Equal(QueueStatus.Waiting, queue.QueueStatus);
        Assert.True(queue.IsReserved);

        // SkuStock: giữ chỗ chỉ 3 từ Kệ (phần Kho không giữ chỗ).
        var stock = await db.SkuStocks.FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(3, stock.ReservedQuantity);

        // Queue item: WarehouseTransferQuantity = 7, FinishedDeductedQuantity = 3.
        var item = Assert.Single(queue.Items);
        Assert.Equal(7, item.WarehouseTransferQuantity);
        Assert.Equal(3, item.FinishedDeductedQuantity);
        Assert.Equal(StockReservationStatus.Active, item.ReservationStatus);
        Assert.Equal(3, item.ReservedQuantity); // chỉ phần Kệ vào Reserved

        // COD reservation trace: 3 đang giữ chỗ (phần Kệ).
        var summary = await logic.GetSkuCodReservationsAsync(skuId);
        var order = Assert.Single(summary.Orders);
        Assert.Equal(3, order.ReservedQuantity);
        Assert.Equal(3, summary.TotalActiveReservedQuantity);
        Assert.Equal(3, summary.SkuStockReservedQuantity);
    }

    [Fact]
    public async Task CodReservation_ShelfAndWarehouseInsufficient_MarksQueueInsufficient()
    {
        // COD yêu cầu 20, Kệ 3, Kho thành phẩm 10 → tổng chỉ 13 → Insufficient.
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        db.SkuStocks.Add(new SkuStock
        {
            SkuId = skuId,
            SkuCode = "SKU-1",
            QuantityOnHand = 3,
            WarehouseQuantityOnHand = 10,
            ReservedQuantity = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 20));

        var queue = await db.StockDeductQueues.Include(q => q.Items).FirstAsync(q => q.OrderId == orderId);
        Assert.Equal(QueueStatus.Insufficient, queue.QueueStatus);
        Assert.False(queue.IsReserved);
        Assert.Contains("Kệ + Kho thành phẩm", queue.LastShortageReason);

        // Không giữ chỗ gì cả.
        var stock = await db.SkuStocks.FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(0, stock.ReservedQuantity);

        var summary = await logic.GetSkuCodReservationsAsync(skuId);
        Assert.Empty(summary.Orders);
    }

    [Fact]
    public async Task CodReservation_WithWarehouseTransfer_ConfirmSucceeds()
    {
        // COD yêu cầu 10: Kệ 3, Kho 15 → giữ chỗ 3, chờ điều chuyển 7.
        // Khi Thủ kho confirm → phần Kệ 3 xuất bán, phần Kho 7 điều chuyển Kho→Kệ rồi xuất bán.
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        db.SkuStocks.Add(new SkuStock
        {
            SkuId = skuId,
            SkuCode = "SKU-1",
            QuantityOnHand = 3,
            WarehouseQuantityOnHand = 15,
            ReservedQuantity = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 10));

        var queue = await db.StockDeductQueues.Include(q => q.Items).FirstAsync(q => q.OrderId == orderId);
        Assert.Equal(QueueStatus.Waiting, queue.QueueStatus);
        Assert.True(queue.IsReserved);

        // Confirm queue.
        await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);

        // Queue → Confirmed, IsDeducted = true.
        await db.Entry(queue).ReloadAsync();
        Assert.Equal(QueueStatus.Confirmed, queue.QueueStatus);
        Assert.True(queue.IsDeducted);

        // Stock: Kệ xuất hết 10 (3 + 7 từ Kho), giữ chỗ nhả hết.
        var stock = await db.SkuStocks.FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(0, stock.ReservedQuantity);
        // QuantityOnHand ban đầu 3, sau điều chuyển +7 từ Kho, xuất bán -10 → còn 0.
        Assert.Equal(0, stock.QuantityOnHand);
        // WarehouseQuantityOnHand ban đầu 15, điều chuyển -7 → còn 8.
        Assert.Equal(8, stock.WarehouseQuantityOnHand);

        // Reservation status → Deducted.
        var item = Assert.Single(queue.Items);
        Assert.Equal(StockReservationStatus.Deducted, item.ReservationStatus);
        Assert.NotNull(item.DeductedAt);
    }

    [Fact]
    public async Task CodReservation_SimulateWarehouseFalse_UsesMinAggregateAndBatch_ForWarehouseCover()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        db.SkuStocks.Add(new SkuStock
        {
            SkuId = skuId,
            SkuCode = "HVT-SET-DOANVIEN",
            QuantityOnHand = 2,
            WarehouseQuantityOnHand = 10,
            ReservedQuantity = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        SeedWarehouseBatch(db, skuId, "HVT-SET-DOANVIEN", quantity: 2, location: "Shelf");
        SeedWarehouseBatch(db, skuId, "HVT-SET-DOANVIEN", quantity: 10, location: "Warehouse");
        await db.SaveChangesAsync();

        var logic = BuildLogic(db, simulateWarehouse: false);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 3));

        var queue = await db.StockDeductQueues.Include(q => q.Items).FirstAsync(q => q.OrderId == orderId);
        Assert.Equal(QueueStatus.Waiting, queue.QueueStatus);
        Assert.Equal("pending_warehouse_transfer", queue.OrderStockStatus);
        Assert.True(queue.IsReserved);

        var item = Assert.Single(queue.Items);
        Assert.Equal(2, item.FinishedDeductedQuantity);
        Assert.Equal(1, item.WarehouseTransferQuantity);
        Assert.Equal(2, item.ReservedQuantity);

        var stock = await db.SkuStocks.FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(2, stock.ReservedQuantity);
    }

    [Fact]
    public async Task CodConfirm_InsufficientQueueWithoutTransferMeta_HealsFromWarehouseFinishedGoods()
    {
        // Queue Insufficient cũ (không có WarehouseTransferQuantity) nhưng Kho thành phẩm vẫn đủ bù.
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        var orderId = Guid.NewGuid();
        var queueId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        db.SkuStocks.Add(new SkuStock
        {
            SkuId = skuId,
            SkuCode = "HVT-SET-DOANVIEN",
            QuantityOnHand = 2,
            WarehouseQuantityOnHand = 5,
            ReservedQuantity = 0,
            CreatedAt = now,
            UpdatedAt = now,
        });
        db.StockDeductQueues.Add(new StockDeductQueue
        {
            Id = queueId,
            OrderId = orderId,
            OrderCode = "COD-HEAL-1",
            QueueStatus = QueueStatus.Insufficient,
            OrderStockStatus = "waiting_stock",
            IsReserved = false,
            IsDeducted = false,
            CreatedAt = now,
            Items =
            {
                new StockDeductQueueItem
                {
                    Id = Guid.NewGuid(),
                    QueueId = queueId,
                    SkuId = skuId,
                    SkuSnapshotCode = "HVT-SET-DOANVIEN",
                    SkuSnapshotName = "Hộp Trà Đoàn Viên Cao Cấp",
                    Quantity = 3,
                    WarehouseTransferQuantity = 0,
                    FinishedDeductedQuantity = null,
                    ReservationStatus = StockReservationStatus.None,
                    ReservedQuantity = 0,
                },
            },
        });
        await db.SaveChangesAsync();

        var logic = BuildLogic(db, simulateWarehouse: true);
        await logic.ConfirmQueueAsync(queueId, Guid.NewGuid(), null);

        var queue = await db.StockDeductQueues.Include(q => q.Items).FirstAsync(q => q.Id == queueId);
        Assert.Equal(QueueStatus.Confirmed, queue.QueueStatus);
        Assert.True(queue.IsDeducted);

        var item = Assert.Single(queue.Items);
        Assert.Equal(2, item.FinishedDeductedQuantity);
        Assert.Equal(1, item.WarehouseTransferQuantity);
        Assert.Equal(StockReservationStatus.Deducted, item.ReservationStatus);

        var stock = await db.SkuStocks.FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(0, stock.ReservedQuantity);
        Assert.Equal(0, stock.QuantityOnHand);
        Assert.Equal(4, stock.WarehouseQuantityOnHand);
    }
}
