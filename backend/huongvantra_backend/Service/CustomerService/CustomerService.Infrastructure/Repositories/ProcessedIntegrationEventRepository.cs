using CustomerService.Application.Interfaces;
using CustomerService.Domain.Entities;
using CustomerService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CustomerService.Infrastructure.Repositories;

public class ProcessedIntegrationEventRepository : IProcessedIntegrationEventRepository
{
    private readonly CustomerDbContext _db;

    public ProcessedIntegrationEventRepository(CustomerDbContext db) => _db = db;

    public Task<bool> ExistsAsync(string eventType, Guid correlationId, CancellationToken ct = default) =>
        _db.ProcessedIntegrationEvents.AnyAsync(
            e => e.EventType == eventType && e.CorrelationId == correlationId, ct);

    public async Task AddAsync(string eventType, Guid correlationId, CancellationToken ct = default)
    {
        await _db.ProcessedIntegrationEvents.AddAsync(new ProcessedIntegrationEvent
        {
            Id = Guid.NewGuid(),
            EventType = eventType,
            CorrelationId = correlationId,
            ProcessedAt = DateTime.UtcNow
        }, ct);
    }

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
