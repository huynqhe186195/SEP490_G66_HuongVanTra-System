using InventoryService.Domain.Entities;
using InventoryService.Infrastructure.Data;
using InventoryService.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace InventoryService.Application.Tests;

/// <summary>
/// G6 — kiểm chứng Inbox dedupe hai tầng của <see cref="ProcessedIntegrationEventRepository"/>:
/// EventId là khoá chống trùng có thẩm quyền; (EventType, CorrelationId) là khoá nghiệp vụ.
/// </summary>
public sealed class ProcessedIntegrationEventInboxTests
{
    private static InventoryDbContext NewContext() =>
        new(new DbContextOptionsBuilder<InventoryDbContext>()
            .UseInMemoryDatabase($"inbox-{Guid.NewGuid():N}")
            .Options);

    [Fact]
    public async Task ExistsByEventId_TrueOnlyAfterRecorded()
    {
        await using var db = NewContext();
        var repo = new ProcessedIntegrationEventRepository(db);
        var eventId = Guid.NewGuid();

        Assert.False(await repo.ExistsByEventIdAsync(eventId));

        await repo.AddAsync("OrderPlaced", Guid.NewGuid(), eventId);
        await repo.SaveChangesAsync();

        Assert.True(await repo.ExistsByEventIdAsync(eventId));
    }

    [Fact]
    public async Task ExistsByEventId_DoesNotMatchDifferentEventId()
    {
        await using var db = NewContext();
        var repo = new ProcessedIntegrationEventRepository(db);

        await repo.AddAsync("OrderPlaced", Guid.NewGuid(), Guid.NewGuid());
        await repo.SaveChangesAsync();

        Assert.False(await repo.ExistsByEventIdAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task BusinessKey_BlocksSecondEventIdForSameCorrelation()
    {
        // Hai EventId khác nhau nhưng cùng nghiệp vụ (cùng OrderId) → khoá nghiệp vụ chặn lần 2.
        await using var db = NewContext();
        var repo = new ProcessedIntegrationEventRepository(db);
        var orderId = Guid.NewGuid();

        await repo.AddAsync("OrderCancelled", orderId, Guid.NewGuid());
        await repo.SaveChangesAsync();

        Assert.True(await repo.ExistsAsync("OrderCancelled", orderId));
    }

    [Fact]
    public async Task NullEventId_IsAllowed_ForSourcesWithoutEventId()
    {
        await using var db = NewContext();
        var repo = new ProcessedIntegrationEventRepository(db);
        var skuId = Guid.NewGuid();

        await repo.AddAsync("SkuCreated", skuId, eventId: null);
        await repo.SaveChangesAsync();

        Assert.True(await repo.ExistsAsync("SkuCreated", skuId));
        var row = await db.ProcessedIntegrationEvents.AsNoTracking().SingleAsync();
        Assert.Null(row.EventId);
    }

    [Fact]
    public async Task Add_PersistsEventIdAndBusinessKeyTogether()
    {
        await using var db = NewContext();
        var repo = new ProcessedIntegrationEventRepository(db);
        var eventId = Guid.NewGuid();
        var returnId = Guid.NewGuid();

        await repo.AddAsync("OrderReturned", returnId, eventId);
        await repo.SaveChangesAsync();

        var row = await db.ProcessedIntegrationEvents.AsNoTracking().SingleAsync();
        Assert.Equal(eventId, row.EventId);
        Assert.Equal(returnId, row.CorrelationId);
        Assert.Equal("OrderReturned", row.EventType);
    }
}
