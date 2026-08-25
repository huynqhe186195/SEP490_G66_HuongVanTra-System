using HuongVanTra.Shared.Notifications;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Domain.Enums;
using InventoryService.Application.Interfaces;
using InventoryService.Application.Options;
using InventoryService.Application.UseCases;
using InventoryService.Domain.Entities;
using InventoryService.Infrastructure.Data;
using InventoryService.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using MSOptions = Microsoft.Extensions.Options.Options;

namespace InventoryService.Application.Tests;

public sealed class InventoryNotificationIntegrationTests
{
    private static InventoryDbContext NewContext() =>
        new(new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase($"inv-notif-{Guid.NewGuid():N}")
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

    private sealed class PassThrough : IInventoryUnitOfWork
    {
        public Task<T> ExecuteInTransactionAsync<T>(
            Func<CancellationToken, Task<T>> action, CancellationToken ct = default) => action(ct);
    }

    private static InventoryLogic BuildLogic(
        InventoryDbContext db,
        Mock<INotificationClient> notificationClientMock,
        bool simulateWarehouse = true)
    {
        var stockRepo = new InMemorySkuStockRepository(db);
        var queueRepo = new StockDeductQueueRepository(db);
        var batchRepo = new WarehouseBatchRepository(db);
        var exportAllocationRepo = new StockExportBatchAllocationRepository(db);
        var ledgerRepo = new InventoryLedgerRepository(db);
        var exportSlipRepo = new StockExportSlipRepository(db);
        var processedEvents = new ProcessedIntegrationEventRepository(db);
        var productionOrderRepo = new ProductionOrderRepository(db);

        var options = MSOptions.Create(new InventoryOptions
        {
            SimulateWarehouse = simulateWarehouse
        });

        return new InventoryLogic(
            stockRepo,
            queueRepo,
            Mock.Of<IStockAdjustmentRequestRepository>(),
            exportSlipRepo,
            Mock.Of<IStockImportSlipRepository>(),
            batchRepo,
            exportAllocationRepo,
            ledgerRepo,
            Mock.Of<ISupplierReceiptRepository>(),
            Mock.Of<ISupplierReturnRequestRepository>(),
            Mock.Of<IStocktakeRequestRepository>(),
            Mock.Of<IShelfReplenishmentSuggestionRepository>(),
            processedEvents,
            Mock.Of<IInventoryEventPublisher>(),
            new PassThrough(),
            productionOrderRepo,
            Mock.Of<IStockTransferRepository>(),
            Mock.Of<IProductCatalogClient>(),
            Mock.Of<ISupplierRepository>(),
            Mock.Of<ISupplierProductRepository>(),
            Mock.Of<IReturnInspectionRepository>(),
            notificationClientMock.Object,
            options);
    }

    [Fact]
    public async Task ReplaceCodReservationAsync_WhenStockSufficient_SendsQueuePendingNotification()
    {
        await using var db = NewContext();
        var notificationMock = new Mock<INotificationClient>();
        var logic = BuildLogic(db, notificationMock, simulateWarehouse: true);

        var skuId = Guid.NewGuid();
        await db.SkuStocks.AddAsync(new SkuStock
        {
            SkuId = skuId,
            SkuCode = "SKU-001",
            QuantityOnHand = 100,
            ReservedQuantity = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var orderId = Guid.NewGuid();
        var queue = new InventoryService.Domain.Entities.StockDeductQueue
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            OrderCode = "COD-001",
            OrderPaymentStatus = "pending",
            OrderStockStatus = "pending_deduct",
            QueueStatus = QueueStatus.Waiting,
            TotalAmount = 100_000,
            IsDeducted = false,
            IsReserved = false,
            CreatedAt = DateTime.UtcNow,
            Items =
            [
                new InventoryService.Domain.Entities.StockDeductQueueItem
                {
                    Id = Guid.NewGuid(),
                    SkuId = skuId,
                    SkuSnapshotName = "Test SKU",
                    SkuSnapshotCode = "SKU-001",
                    Quantity = 10,
                    ReservationStatus = StockReservationStatus.None,
                }
            ]
        };
        await db.StockDeductQueues.AddAsync(queue);
        await db.SaveChangesAsync();

        var request = new ReplaceCodReservationRequest(
            OrderId: orderId,
            OperationId: Guid.NewGuid(),
            TotalAmount: 100_000,
            Items: new List<ReplaceCodReservationItemRequest>
            {
                new(SkuId: skuId, SkuSnapshotName: "Test SKU", SkuSnapshotCode: "SKU-001", Quantity: 10)
            });

        await logic.ReplaceCodReservationAsync(request, CancellationToken.None);

        notificationMock.Verify(
            n => n.SendBroadcastAsync(
                "Warehouse",
                NotificationTypes.StockQueuePendingConfirm,
                It.IsAny<string>(),
                It.IsAny<string>()),
            Times.AtLeastOnce);
    }

    [Fact]
    public async Task PreparePosStockDeduction_WhenStockBelowThreshold_SendsLowStockAlert()
    {
        await using var db = NewContext();
        var notificationMock = new Mock<INotificationClient>();
        var logic = BuildLogic(db, notificationMock, simulateWarehouse: true);

        var skuId = Guid.NewGuid();
        await db.SkuStocks.AddAsync(new SkuStock
        {
            SkuId = skuId,
            SkuCode = "SKU-LOW",
            QuantityOnHand = 5,
            ReservedQuantity = 0,
            ShelfLowStockThreshold = 10,
            LowStockThreshold = 10,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var request = new PreparePosStockDeductionRequest(
            OrderId: Guid.NewGuid(),
            OrderCode: "POS-001",
            OrderStatus: "Processing",
            TotalAmount: 10_000,
            Items: new List<PreparePosStockDeductionItemRequest>
            {
                new(SkuId: skuId, SkuSnapshotName: "Low Stock SKU", SkuSnapshotCode: "SKU-LOW", Quantity: 1)
            });

        await logic.PreparePosStockDeductionAsync(request, Guid.NewGuid(), null, CancellationToken.None);

        notificationMock.Verify(
            n => n.SendBroadcastAsync(
                "Warehouse",
                NotificationTypes.LowStockAlert,
                It.IsAny<string>(),
                "/inventory/statistics"),
            Times.Once);
    }
}
