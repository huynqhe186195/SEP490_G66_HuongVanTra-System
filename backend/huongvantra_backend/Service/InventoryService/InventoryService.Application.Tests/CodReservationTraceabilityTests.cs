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

    private static InventoryLogic BuildLogic(InventoryDbContext db) =>
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
            Mock.Of<IShelfReturnRequestRepository>(),
            Mock.Of<ISupplierReturnRequestRepository>(),
            Mock.Of<IStocktakeRequestRepository>(),
            Mock.Of<IShelfReplenishmentSuggestionRepository>(),
            new ProcessedIntegrationEventRepository(db),
            Mock.Of<IInventoryEventPublisher>(),
            new PassThroughUnitOfWork(),
            Mock.Of<IProductionOrderRepository>(),
            Mock.Of<IProductCatalogClient>(),
            Mock.Of<ISupplierRepository>(),
            Mock.Of<ISupplierProductRepository>(),
            Mock.Of<IReturnInspectionRepository>(),
            Microsoft.Extensions.Options.Options.Create(
                new InventoryOptions { SimulateWarehouse = true }));

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
}
