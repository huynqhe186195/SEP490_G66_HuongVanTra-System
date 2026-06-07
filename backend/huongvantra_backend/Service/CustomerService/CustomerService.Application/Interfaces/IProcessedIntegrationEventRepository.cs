namespace CustomerService.Application.Interfaces;

public interface IProcessedIntegrationEventRepository
{
    Task<bool> ExistsAsync(string eventType, Guid correlationId, CancellationToken ct = default);
    Task AddAsync(string eventType, Guid correlationId, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
