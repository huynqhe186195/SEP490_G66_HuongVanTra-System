using Microsoft.EntityFrameworkCore;
using OrderService.Application.UseCases;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;
using OrderService.Infrastructure.Repositories;
using Xunit;

namespace OrderService.Application.Tests;

/// <summary>
/// G7 — kiểm chứng nghiệp vụ giám sát Outbox: phân trang/lọc, thống kê theo trạng thái,
/// xem chi tiết kèm payload, và retry thủ công đưa message thất bại về hàng đợi.
/// </summary>
public sealed class OutboxMonitoringTests
{
    private static OrderDbContext NewContext() =>
        new(new DbContextOptionsBuilder<OrderDbContext>()
            .UseInMemoryDatabase($"outbox-mon-{Guid.NewGuid():N}")
            .Options);

    private static OutboxMessage NewMessage(
        OutboxMessageStatus status,
        string eventType = "OrderPlacedEvent",
        DateTime? occurredAt = null,
        int retryCount = 0) => new()
    {
        Id = Guid.NewGuid(),
        EventType = eventType,
        AggregateId = Guid.NewGuid(),
        Payload = "{\"k\":\"v\"}",
        Status = status,
        RetryCount = retryCount,
        OccurredAtUtc = occurredAt ?? DateTime.UtcNow,
        NextAttemptAtUtc = DateTime.UtcNow
    };

    private static async Task SeedAsync(OrderDbContext db, params OutboxMessage[] messages)
    {
        await db.OutboxMessages.AddRangeAsync(messages);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetPaged_FiltersByStatus_AndNewestFirst()
    {
        await using var db = NewContext();
        var older = NewMessage(OutboxMessageStatus.Failed, occurredAt: DateTime.UtcNow.AddMinutes(-10));
        var newer = NewMessage(OutboxMessageStatus.Failed, occurredAt: DateTime.UtcNow.AddMinutes(-1));
        await SeedAsync(db, older, newer, NewMessage(OutboxMessageStatus.Published));

        var logic = new OutboxMonitoringLogic(new OutboxMonitoringRepository(db));
        var result = await logic.GetPagedAsync(OutboxMessageStatus.Failed, null, 1, 20);

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(newer.Id, result.Items[0].Id); // mới nhất trước
        Assert.Equal(older.Id, result.Items[1].Id);
        Assert.All(result.Items, i => Assert.Equal("Failed", i.Status));
    }

    [Fact]
    public async Task GetPaged_FiltersByEventTypeSubstring()
    {
        await using var db = NewContext();
        await SeedAsync(db,
            NewMessage(OutboxMessageStatus.Pending, "OrderPlacedEvent"),
            NewMessage(OutboxMessageStatus.Pending, "OrderCancelledEvent"));

        var logic = new OutboxMonitoringLogic(new OutboxMonitoringRepository(db));
        var result = await logic.GetPagedAsync(null, "Cancelled", 1, 20);

        Assert.Equal(1, result.TotalCount);
        Assert.Equal("OrderCancelledEvent", result.Items[0].EventType);
    }

    [Fact]
    public async Task GetStats_CountsEachStatus()
    {
        await using var db = NewContext();
        await SeedAsync(db,
            NewMessage(OutboxMessageStatus.Pending),
            NewMessage(OutboxMessageStatus.Pending),
            NewMessage(OutboxMessageStatus.Processing),
            NewMessage(OutboxMessageStatus.Published),
            NewMessage(OutboxMessageStatus.Failed));

        var logic = new OutboxMonitoringLogic(new OutboxMonitoringRepository(db));
        var stats = await logic.GetStatsAsync();

        Assert.Equal(2, stats.Pending);
        Assert.Equal(1, stats.Processing);
        Assert.Equal(1, stats.Published);
        Assert.Equal(1, stats.Failed);
    }

    [Fact]
    public async Task GetById_ReturnsDetailWithPayload()
    {
        await using var db = NewContext();
        var msg = NewMessage(OutboxMessageStatus.Failed);
        await SeedAsync(db, msg);

        var logic = new OutboxMonitoringLogic(new OutboxMonitoringRepository(db));
        var detail = await logic.GetByIdAsync(msg.Id);

        Assert.NotNull(detail);
        Assert.Equal(msg.Id, detail!.Id);
        Assert.Equal("{\"k\":\"v\"}", detail.Payload);
    }

    [Fact]
    public async Task Retry_FailedMessage_ResetsToPendingAndClearsLease()
    {
        await using var db = NewContext();
        var msg = NewMessage(OutboxMessageStatus.Failed, retryCount: 5);
        msg.LockedBy = "worker-x";
        msg.LockedUntilUtc = DateTime.UtcNow.AddMinutes(5);
        await SeedAsync(db, msg);

        var logic = new OutboxMonitoringLogic(new OutboxMonitoringRepository(db));
        var result = await logic.RetryAsync(msg.Id);

        Assert.Equal("Pending", result.Status);
        var reloaded = await db.OutboxMessages.AsNoTracking().SingleAsync(m => m.Id == msg.Id);
        Assert.Equal(OutboxMessageStatus.Pending, reloaded.Status);
        Assert.Null(reloaded.LockedBy);
        Assert.Null(reloaded.LockedUntilUtc);
    }

    [Fact]
    public async Task Retry_PublishedMessage_IsNoOp()
    {
        await using var db = NewContext();
        var msg = NewMessage(OutboxMessageStatus.Published);
        msg.PublishedAtUtc = DateTime.UtcNow;
        await SeedAsync(db, msg);

        var logic = new OutboxMonitoringLogic(new OutboxMonitoringRepository(db));
        var result = await logic.RetryAsync(msg.Id);

        Assert.Equal("Published", result.Status);
        var reloaded = await db.OutboxMessages.AsNoTracking().SingleAsync(m => m.Id == msg.Id);
        Assert.Equal(OutboxMessageStatus.Published, reloaded.Status);
    }

    [Fact]
    public async Task Retry_UnknownId_ReturnsNotFound()
    {
        await using var db = NewContext();
        var logic = new OutboxMonitoringLogic(new OutboxMonitoringRepository(db));

        var result = await logic.RetryAsync(Guid.NewGuid());

        Assert.Equal("NotFound", result.Status);
    }
}
