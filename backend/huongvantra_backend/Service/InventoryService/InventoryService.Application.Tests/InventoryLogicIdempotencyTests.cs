using HuongVanTra.Shared.Messages;
using InventoryService.Application.Interfaces;
using InventoryService.Application.Options;
using InventoryService.Application.UseCases;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using InventoryService.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace InventoryService.Application.Tests;

/// <summary>
/// G6 — kiểm chứng idempotent consumer ở tầng handler: cùng một EventId giao lại
/// nhiều lần chỉ gây tác động tồn kho đúng một lần; đơn đã xử lý theo khoá nghiệp vụ
/// cũng không bị xử lý lại dù EventId khác.
/// </summary>
public sealed class InventoryLogicIdempotencyTests
{
    private static InventoryDbContext NewContext() =>
        new(new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase($"inv-logic-{Guid.NewGuid():N}")
            .Options);

    private static InventoryLogic BuildLogic(
        InventoryDbContext db,
        IStockDeductQueueRepository queueRepo)
    {
        var processed = new ProcessedIntegrationEventRepository(db);

        return new InventoryLogic(
            Mock.Of<ISkuStockRepository>(),
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
            Mock.Of<IShelfReplenishmentSuggestionRepository>(),
            processed,
            Mock.Of<IInventoryEventPublisher>(),
            BuildPassThroughUnitOfWork(),
            Mock.Of<IProductionOrderRepository>(),
            Mock.Of<IProductCatalogClient>(),
            Mock.Of<ISupplierRepository>(),
            Mock.Of<ISupplierProductRepository>(),
            Mock.Of<IReturnInspectionRepository>(),
            Microsoft.Extensions.Options.Options.Create(new InventoryOptions()));
    }

    private static IInventoryUnitOfWork BuildPassThroughUnitOfWork()
    {
        var uow = new Mock<IInventoryUnitOfWork>();
        uow.Setup(u => u.ExecuteInTransactionAsync(
                It.IsAny<Func<CancellationToken, Task<bool>>>(), It.IsAny<CancellationToken>()))
            .Returns((Func<CancellationToken, Task<bool>> action, CancellationToken ct) => action(ct));
        return uow.Object;
    }

    [Fact]
    public async Task HandleOrderPlaced_SameEventIdTwice_CreatesQueueOnce()
    {
        await using var db = NewContext();
        var created = new List<StockDeductQueue>();

        var queueRepo = new Mock<IStockDeductQueueRepository>();
        queueRepo.Setup(r => r.GetByOrderIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid _, CancellationToken _) => created.FirstOrDefault());
        queueRepo.Setup(r => r.AddAsync(It.IsAny<StockDeductQueue>(), It.IsAny<CancellationToken>()))
            .Callback<StockDeductQueue, CancellationToken>((q, _) => created.Add(q))
            .Returns(Task.CompletedTask);
        // Repos dùng chung một InventoryDbContext trong production → SaveChanges bất kỳ repo
        // nào cũng persist inbox row. Mô phỏng bằng cách flush shared context.
        queueRepo.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Returns((CancellationToken c) => db.SaveChangesAsync(c));

        var logic = BuildLogic(db, queueRepo.Object);
        var evt = new OrderPlacedEvent
        {
            EventId = Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = Guid.NewGuid(),
            OrderCode = "HVT-1",
            OrderStatus = "PendingPayment",
            TotalAmount = 10_000m,
            Items = new[] { new OrderItemEvent { SkuId = Guid.NewGuid(), Quantity = 2 } }
        };

        await logic.HandleOrderPlacedAsync(evt);
        await logic.HandleOrderPlacedAsync(evt); // redelivery cùng EventId

        Assert.Single(created);
        queueRepo.Verify(r => r.AddAsync(It.IsAny<StockDeductQueue>(), It.IsAny<CancellationToken>()), Times.Once);
        Assert.Equal(1, await db.ProcessedIntegrationEvents.CountAsync());
    }

    [Fact]
    public async Task HandleOrderPlaced_AlreadyProcessedEventId_IsShortCircuited()
    {
        await using var db = NewContext();
        var eventId = Guid.NewGuid();
        db.ProcessedIntegrationEvents.Add(new ProcessedIntegrationEvent
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            EventType = InventoryLogic.OrderPlacedEventType,
            CorrelationId = Guid.NewGuid(),
            ProcessedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var queueRepo = new Mock<IStockDeductQueueRepository>(MockBehavior.Strict);
        var logic = BuildLogic(db, queueRepo.Object);

        var evt = new OrderPlacedEvent
        {
            EventId = eventId,
            OrderId = Guid.NewGuid(),
            OrderCode = "HVT-2",
            OrderStatus = "PendingPayment",
            Items = Array.Empty<OrderItemEvent>()
        };

        // Không gọi bất kỳ method nào trên queueRepo (Strict) → chứng minh short-circuit.
        await logic.HandleOrderPlacedAsync(evt);
        Assert.Equal(1, await db.ProcessedIntegrationEvents.CountAsync());
    }

    [Fact]
    public async Task HandleOrderCancelled_SameOrderId_SecondEventIdBlockedByBusinessKey()
    {
        await using var db = NewContext();
        var orderId = Guid.NewGuid();

        var queueRepo = new Mock<IStockDeductQueueRepository>();
        queueRepo.Setup(r => r.GetByOrderIdAsync(orderId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StockDeductQueue?)null);
        queueRepo.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Returns((CancellationToken c) => db.SaveChangesAsync(c));

        var logic = BuildLogic(db, queueRepo.Object);

        await logic.HandleOrderCancelledAsync(new OrderCancelledEvent
        {
            EventId = Guid.NewGuid(), OrderId = orderId, OrderCode = "HVT-3",
            Items = Array.Empty<OrderItemEvent>()
        });

        // EventId khác nhưng cùng OrderId → khoá nghiệp vụ chặn, không ghi thêm inbox row.
        await logic.HandleOrderCancelledAsync(new OrderCancelledEvent
        {
            EventId = Guid.NewGuid(), OrderId = orderId, OrderCode = "HVT-3",
            Items = Array.Empty<OrderItemEvent>()
        });

        Assert.Equal(1, await db.ProcessedIntegrationEvents.CountAsync());
    }
}
