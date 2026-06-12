using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Application.Interfaces;

public interface IPromotionRepository
{
    Task<List<Promotion>> GetAllAsync(CancellationToken ct = default);
    Task<(List<Promotion> Items, int TotalCount)> GetPagedAsync(
        string? search,
        PromotionDiscountType? discountType,
        PromotionScopeType? scopeType,
        bool? isActive,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<Promotion?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Promotion?> GetByNormalizedCodeAsync(string normalizedCode, CancellationToken ct = default);
    Task<Promotion?> GetActiveByNormalizedCodeAsync(string normalizedCode, CancellationToken ct = default);
    Task<List<Promotion>> GetAvailableAsync(DateTime nowUtc, CancellationToken ct = default);
    Task<int> CountOrdersUsingPromotionAsync(Guid promotionId, CancellationToken ct = default);
    Task<int> CountOrdersUsingPromotionByCustomerAsync(Guid promotionId, Guid customerId, CancellationToken ct = default);
    Task AddAsync(Promotion promotion, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
