using HuongVanTra.Shared.Messages;
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
/// POS-04 (H4) — giữ chỗ tồn Kệ Hàng cho đơn COD chờ xác nhận. Kiểm chứng:
/// giữ chỗ khi vào queue, idempotent, tồn khả bán = OnHand - Reserved,
/// nhả khi hủy, và trừ tồn tiêu thụ đúng phần giữ chỗ của chính queue.
/// Dùng InMemory + repo tồn nền EF thật (không FOR UPDATE) để mô phỏng.
/// </summary>
public sealed class InventoryReservationTests
{
    private static InventoryDbContext NewContext() =>
        new(new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase($"inv-reserve-{Guid.NewGuid():N}")
            .Options);

    /// <summary>
    /// Repo tồn nền EF thật nhưng GetBySkuIdWithLockAsync tránh raw SQL FOR UPDATE
    /// (InMemory không hỗ trợ) — hành vi khoá dòng để dành cho Docker gate.
    /// </summary>
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

    private static InventoryLogic BuildLogic(
        InventoryDbContext db,
        IInventoryEventPublisher? publisher = null)
    {
        var stockRepo = new InMemorySkuStockRepository(db);
        var queueRepo = new StockDeductQueueRepository(db);
        var processed = new ProcessedIntegrationEventRepository(db);

        return new InventoryLogic(
            stockRepo,
            queueRepo,
            Mock.Of<IStockAdjustmentRequestRepository>(),
            Mock.Of<IStockExportSlipRepository>(),
            Mock.Of<IStockImportSlipRepository>(),
            Mock.Of<IWarehouseBatchRepository>(),
            Mock.Of<IStockExportBatchAllocationRepository>(),
            Mock.Of<IInventoryLedgerRepository>(),
            Mock.Of<ISupplierReceiptRepository>(),
            Mock.Of<IShelfReturnRequestRepository>(),
            Mock.Of<ISupplierReturnRequestRepository>(),
            Mock.Of<IStocktakeRequestRepository>(),
            processed,
            publisher ?? Mock.Of<IInventoryEventPublisher>(),
            BuildPassThroughUnitOfWork(db),
            Mock.Of<IProductionOrderRepository>(),
            Mock.Of<IProductCatalogClient>(),
            Mock.Of<ISupplierRepository>(),
            Microsoft.Extensions.Options.Options.Create(new InventoryOptions()));
    }

    /// <summary>
    /// Pass-through UoW cho mọi T (ConfirmQueue dùng T là type private của InventoryLogic
    /// nên không thể set up qua Moq generic) — thực thi trực tiếp action, không giao dịch thật.
    /// </summary>
    private sealed class PassThroughUnitOfWork : IInventoryUnitOfWork
    {
        public Task<T> ExecuteInTransactionAsync<T>(
            Func<CancellationToken, Task<T>> action, CancellationToken ct = default) => action(ct);
    }

    private static IInventoryUnitOfWork BuildPassThroughUnitOfWork(InventoryDbContext db) =>
        new PassThroughUnitOfWork();

    private static async Task<SkuStock> SeedStockAsync(
        InventoryDbContext db, Guid skuId, int onHand, string code = "SKU-1")
    {
        var stock = new SkuStock
        {
            SkuId = skuId,
            SkuCode = code,
            QuantityOnHand = onHand,
            ReservedQuantity = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.SkuStocks.Add(stock);
        await db.SaveChangesAsync();
        return stock;
    }

    private static OrderPlacedEvent CodPlaced(Guid orderId, Guid skuId, int qty, string code = "HVT-R1") =>
        new()
        {
            EventId = Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = code,
            OrderStatus = "PendingPayment",
            OrderChannel = "COD",
            TotalAmount = 10_000m,
            Items = new[] { new OrderItemEvent { SkuId = skuId, SkuCode = "SKU-1", Quantity = qty } }
        };

    [Fact]
    public async Task PendingCod_ReservesShelfStock_AndReducesAvailability()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var logic = BuildLogic(db);

        await logic.HandleOrderPlacedAsync(CodPlaced(Guid.NewGuid(), skuId, 3));

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(10, stock.QuantityOnHand);   // tồn vật lý không đổi
        Assert.Equal(3, stock.ReservedQuantity);  // đã giữ chỗ

        var store = await logic.GetStoreSkuStocksAsync();
        var line = store.Single(s => s.SkuId == skuId);
        Assert.Equal(3, line.ReservedQuantity);
        Assert.Equal(7, line.AvailableQuantity);  // khả bán = 10 - 3
    }

    [Fact]
    public async Task Reservation_IsIdempotent_AcrossRedelivery()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();
        var evt = CodPlaced(orderId, skuId, 4);

        await logic.HandleOrderPlacedAsync(evt);
        await logic.HandleOrderPlacedAsync(evt); // cùng EventId → short-circuit

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(4, stock.ReservedQuantity); // vẫn chỉ giữ 1 lần
    }

    [Fact]
    public async Task CancelBeforeDeduct_ReleasesReservation()
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
            OrderCode = "HVT-R1",
            Items = new[] { new OrderItemEvent { SkuId = skuId, Quantity = 5 } }
        });

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(10, stock.QuantityOnHand);
        Assert.Equal(0, stock.ReservedQuantity); // đã nhả giữ chỗ
    }

    [Fact]
    public async Task ManualCancelQueue_ReleasesReservation()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 8);
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 2));
        var queue = await db.StockDeductQueues.Include(q => q.Items)
            .FirstAsync(q => q.OrderId == orderId);

        await logic.CancelQueueAsync(queue.Id, new(Reason: "khách đổi ý"), Guid.NewGuid(), null);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(0, stock.ReservedQuantity);
    }

    [Fact]
    public async Task ConfirmDeduct_ConsumesReservation_AndReducesPhysicalStock()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var logic = BuildLogic(db);
        var orderId = Guid.NewGuid();

        await logic.HandleOrderPlacedAsync(CodPlaced(orderId, skuId, 6));
        var queue = await db.StockDeductQueues.Include(q => q.Items)
            .FirstAsync(q => q.OrderId == orderId);

        await logic.ConfirmQueueAsync(queue.Id, Guid.NewGuid(), null);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(4, stock.QuantityOnHand);    // trừ tồn vật lý 10 - 6
        Assert.Equal(0, stock.ReservedQuantity);  // giữ chỗ đã tiêu thụ hết
    }

    [Fact]
    public async Task OtherReservation_BlocksSellFirstAvailability_ButOwnReservationDeducts()
    {
        await using var db = NewContext();
        var skuId = Guid.NewGuid();
        await SeedStockAsync(db, skuId, onHand: 10);
        var logic = BuildLogic(db);

        // Đơn COD A giữ 8 → khả bán còn 2.
        await logic.HandleOrderPlacedAsync(CodPlaced(Guid.NewGuid(), skuId, 8, "HVT-A"));
        var afterReserve = await logic.GetStoreSkuStocksAsync();
        Assert.Equal(2, afterReserve.Single(s => s.SkuId == skuId).AvailableQuantity);

        // Xác nhận đơn A: giữ chỗ của chính nó không tự chặn → trừ tồn thành công.
        var queueA = await db.StockDeductQueues.Include(q => q.Items)
            .FirstAsync(q => q.OrderCode == "HVT-A");
        await logic.ConfirmQueueAsync(queueA.Id, Guid.NewGuid(), null);

        var stock = await db.SkuStocks.AsNoTracking().FirstAsync(s => s.SkuId == skuId);
        Assert.Equal(2, stock.QuantityOnHand);
        Assert.Equal(0, stock.ReservedQuantity);
    }
}
