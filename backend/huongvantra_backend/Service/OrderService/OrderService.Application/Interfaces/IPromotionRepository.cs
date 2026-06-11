using OrderService.Domain.Entities;

namespace OrderService.Application.Interfaces;

public interface IPromotionRepository
{
    Task<List<Promotion>> GetAllAsync(CancellationToken ct = default);
    Task<Promotion?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Promotion?> GetByNormalizedCodeAsync(string normalizedCode, CancellationToken ct = default);
    Task<Promotion?> GetActiveByNormalizedCodeAsync(string normalizedCode, CancellationToken ct = default);
    Task<int> CountOrdersUsingPromotionAsync(Guid promotionId, CancellationToken ct = default);
    Task AddAsync(Promotion promotion, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
