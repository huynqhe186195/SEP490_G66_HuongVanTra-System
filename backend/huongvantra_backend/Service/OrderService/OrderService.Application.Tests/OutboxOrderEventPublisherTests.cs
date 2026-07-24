using System.Text.Json;
using HuongVanTra.Shared.Messages;
using Microsoft.EntityFrameworkCore;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;
using OrderService.Infrastructure.Messaging;
using Xunit;

namespace OrderService.Application.Tests;

/// <summary>
/// G4 — kiểm chứng OutboxOrderEventPublisher ghi integration event vào Outbox
/// theo mô hình transactional: EventId trùng OutboxMessage.Id, đúng một row mỗi
/// lần publish, và không tự SaveChanges (để atomic với business transaction).
/// </summary>
public sealed class OutboxOrderEventPublisherTests
{
    private static OrderDbContext NewContext() =>
        new(new DbContextOptionsBuilder<OrderDbContext>()
            .UseInMemoryDatabase($"outbox-pub-{Guid.NewGuid():N}")
            .Options);

    [Fact]
    public async Task PublishOrderPlaced_WritesSingleOutboxRow_WithEventIdEqualToId()
    {
        await using var db = NewContext();
        var publisher = new OutboxOrderEventPublisher(new OrderOutboxWriter(db));
        var orderId = Guid.NewGuid();

        await publisher.PublishOrderPlacedAsync(
            orderId, "HVT-1", OrderStatus.Completed.ToString(), OrderChannel.COD.ToString(), 10_000m,
            new[] { (Guid.NewGuid(), "SKU A", (string?)"A1", 2) });

        // Chưa SaveChanges → chưa persist, nhưng đã track đúng một entity.
        Assert.Empty(await db.OutboxMessages.AsNoTracking().ToListAsync());
        var tracked = Assert.Single(db.OutboxMessages.Local);

        Assert.Equal(orderId, tracked.AggregateId);
        Assert.Equal(typeof(OrderPlacedEvent).FullName, tracked.EventType);
        Assert.Equal(OutboxMessageStatus.Pending, tracked.Status);

        using var doc = JsonDocument.Parse(tracked.Payload);
        var payloadEventId = doc.RootElement.GetProperty("eventId").GetGuid();
        Assert.Equal(tracked.Id, payloadEventId);
        Assert.NotEqual(Guid.Empty, tracked.Id);
        Assert.Equal(orderId, doc.RootElement.GetProperty("orderId").GetGuid());
    }

    [Fact]
    public async Task PublishOrderCompleted_PersistsWithCodSettlement_WhenCallerSaves()
    {
        await using var db = NewContext();
        var publisher = new OutboxOrderEventPublisher(new OrderOutboxWriter(db));
        var orderId = Guid.NewGuid();
        var customerId = Guid.NewGuid();

        await publisher.PublishOrderCompletedAsync(
            orderId, "HVT-2", customerId, 50_000m, 5_000m,
            new[] { (Guid.NewGuid(), 3) },
            codDebtSettlementJson: "{\"applied\":1000}");
        await db.SaveChangesAsync();

        var row = await db.OutboxMessages.AsNoTracking().SingleAsync();
        Assert.Equal(typeof(OrderCompletedEvent).FullName, row.EventType);
        using var doc = JsonDocument.Parse(row.Payload);
        Assert.Equal(row.Id, doc.RootElement.GetProperty("eventId").GetGuid());
        Assert.Equal("{\"applied\":1000}", doc.RootElement.GetProperty("codDebtSettlementJson").GetString());
    }

    [Fact]
    public async Task PublishOrderCancelled_UsesOrderIdAsAggregate()
    {
        await using var db = NewContext();
        var publisher = new OutboxOrderEventPublisher(new OrderOutboxWriter(db));
        var orderId = Guid.NewGuid();

        await publisher.PublishOrderCancelledAsync(
            orderId, "HVT-3", OrderStatus.PendingPayment.ToString(), new[] { (Guid.NewGuid(), 1) });

        var tracked = Assert.Single(db.OutboxMessages.Local);
        Assert.Equal(orderId, tracked.AggregateId);
        Assert.Equal(typeof(OrderCancelledEvent).FullName, tracked.EventType);
    }

    [Fact]
    public async Task PublishOrderReturned_UsesReturnIdAsAggregate()
    {
        await using var db = NewContext();
        var publisher = new OutboxOrderEventPublisher(new OrderOutboxWriter(db));
        var returnId = Guid.NewGuid();
        var orderId = Guid.NewGuid();

        await publisher.PublishOrderReturnedAsync(
            returnId, "RET-1", orderId, "HVT-4", customerId: Guid.NewGuid(),
            returnAmount: 20_000m, orderFinalAmount: 100_000m, refundAmount: 20_000m,
            items: new[] { (Guid.NewGuid(), "SKU B", (string?)"B1", 1) });

        var tracked = Assert.Single(db.OutboxMessages.Local);
        Assert.Equal(returnId, tracked.AggregateId);
        Assert.Equal(typeof(OrderReturnedEvent).FullName, tracked.EventType);
        using var doc = JsonDocument.Parse(tracked.Payload);
        Assert.Equal(tracked.Id, doc.RootElement.GetProperty("eventId").GetGuid());
        Assert.Equal(returnId, doc.RootElement.GetProperty("returnId").GetGuid());
    }

    [Fact]
    public async Task EachPublish_ProducesDistinctEventId()
    {
        await using var db = NewContext();
        var publisher = new OutboxOrderEventPublisher(new OrderOutboxWriter(db));
        var orderId = Guid.NewGuid();

        await publisher.PublishOrderPlacedAsync(
            orderId, "HVT-5", "Completed", "POS", 1m, Array.Empty<(Guid, string, string?, int)>());
        await publisher.PublishOrderPlacedAsync(
            orderId, "HVT-5", "Completed", "POS", 1m, Array.Empty<(Guid, string, string?, int)>());

        var ids = db.OutboxMessages.Local.Select(m => m.Id).ToList();
        Assert.Equal(2, ids.Count);
        Assert.Equal(2, ids.Distinct().Count());
    }
}
