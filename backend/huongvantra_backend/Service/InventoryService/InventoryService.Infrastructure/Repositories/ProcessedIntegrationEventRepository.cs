using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class ProcessedIntegrationEventRepository(InventoryDbContext _db) : IProcessedIntegrationEventRepository
{
    public Task<bool> ExistsByEventIdAsync(Guid eventId, CancellationToken ct = default) =>
        _db.ProcessedIntegrationEvents.AnyAsync(e => e.EventId == eventId, ct);

    public Task<bool> ExistsAsync(string eventType, Guid correlationId, CancellationToken ct = default) =>
        _db.ProcessedIntegrationEvents.AnyAsync(
            e => e.EventType == eventType && e.CorrelationId == correlationId, ct);

    public async Task AddAsync(string eventType, Guid correlationId, Guid? eventId = null, CancellationToken ct = default)
    {
        await _db.ProcessedIntegrationEvents.AddAsync(new ProcessedIntegrationEvent
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            EventType = eventType,
            CorrelationId = correlationId,
            ProcessedAt = DateTime.UtcNow
        }, ct);
    }

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
