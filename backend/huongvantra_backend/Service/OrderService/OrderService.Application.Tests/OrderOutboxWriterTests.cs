using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;
using OrderService.Infrastructure.Messaging;
using Xunit;

namespace OrderService.Application.Tests;

public sealed class OrderOutboxWriterTests
{
    [Fact]
    public async Task EnqueueAsync_AddsPendingMessageWithoutSavingDatabase()
    {
        // Arrange
        var databaseName = $"order-outbox-writer-{Guid.NewGuid():N}";

        var options = new DbContextOptionsBuilder<OrderDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options;

        await using var dbContext = new OrderDbContext(options);

        var writer = new OrderOutboxWriter(dbContext);

        var eventId = Guid.NewGuid();
        var orderId = Guid.NewGuid();

        var integrationEvent = new TestIntegrationEvent(
            EventId: eventId,
            OrderId: orderId,
            Action: "OrderCreated");

        // Act
        await writer.EnqueueAsync(
            eventId,
            orderId,
            integrationEvent);

        // Assert: Writer đã thêm entity vào ChangeTracker.
        var trackedMessage = Assert.Single(dbContext.OutboxMessages.Local);

        Assert.Equal(eventId, trackedMessage.Id);
        Assert.Equal(orderId, trackedMessage.AggregateId);
        Assert.Equal(
            typeof(TestIntegrationEvent).FullName,
            trackedMessage.EventType);

        Assert.Equal(
            OutboxMessageStatus.Pending,
            trackedMessage.Status);

        Assert.Equal(0, trackedMessage.RetryCount);
        Assert.Null(trackedMessage.LastAttemptAtUtc);
        Assert.Null(trackedMessage.LockedUntilUtc);
        Assert.Null(trackedMessage.LockedBy);
        Assert.Null(trackedMessage.PublishedAtUtc);
        Assert.Null(trackedMessage.LastError);

        Assert.NotEqual(default, trackedMessage.OccurredAtUtc);
        Assert.Equal(
            trackedMessage.OccurredAtUtc,
            trackedMessage.NextAttemptAtUtc);

        Assert.Equal(
            EntityState.Added,
            dbContext.Entry(trackedMessage).State);

        // Writer không được tự gọi SaveChangesAsync.
        // Vì vậy database vật lý vẫn chưa có bản ghi.
        var persistedMessages = await dbContext.OutboxMessages
            .AsNoTracking()
            .ToListAsync();

        Assert.Empty(persistedMessages);
    }

    [Fact]
    public async Task EnqueueAsync_PersistsCorrectMessageWhenCallerSavesChanges()
    {
        // Arrange
        var databaseName = $"order-outbox-persist-{Guid.NewGuid():N}";

        var options = new DbContextOptionsBuilder<OrderDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options;

        var eventId = Guid.NewGuid();
        var orderId = Guid.NewGuid();

        var integrationEvent = new TestIntegrationEvent(
            EventId: eventId,
            OrderId: orderId,
            Action: "OrderCompleted");

        // Act: Writer chỉ enqueue, caller mới chủ động SaveChanges.
        await using (var writeContext = new OrderDbContext(options))
        {
            var writer = new OrderOutboxWriter(writeContext);

            await writer.EnqueueAsync(
                eventId,
                orderId,
                integrationEvent);

            await writeContext.SaveChangesAsync();
        }

        // Assert bằng DbContext mới để chắc chắn dữ liệu đã persist.
        await using var readContext = new OrderDbContext(options);

        var persistedMessage = await readContext.OutboxMessages
            .AsNoTracking()
            .SingleAsync();

        Assert.Equal(eventId, persistedMessage.Id);
        Assert.Equal(orderId, persistedMessage.AggregateId);
        Assert.Equal(
            typeof(TestIntegrationEvent).FullName,
            persistedMessage.EventType);

        Assert.Equal(
            OutboxMessageStatus.Pending,
            persistedMessage.Status);

        Assert.Equal(0, persistedMessage.RetryCount);
        Assert.Equal(
            persistedMessage.OccurredAtUtc,
            persistedMessage.NextAttemptAtUtc);

        using var payloadDocument =
            JsonDocument.Parse(persistedMessage.Payload);

        var payload = payloadDocument.RootElement;

        Assert.Equal(
            eventId.ToString(),
            payload.GetProperty("eventId").GetString());

        Assert.Equal(
            orderId.ToString(),
            payload.GetProperty("orderId").GetString());

        Assert.Equal(
            "OrderCompleted",
            payload.GetProperty("action").GetString());
    }

    private sealed record TestIntegrationEvent(
        Guid EventId,
        Guid OrderId,
        string Action);
}