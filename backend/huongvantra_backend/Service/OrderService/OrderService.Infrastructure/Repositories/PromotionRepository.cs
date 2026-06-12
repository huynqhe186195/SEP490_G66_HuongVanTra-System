using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class PromotionRepository(OrderDbContext _db) : IPromotionRepository
{
    public async Task<List<Promotion>> GetAllAsync(CancellationToken ct = default) =>
        await _db.Promotions
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

    public async Task<(List<Promotion> Items, int TotalCount)> GetPagedAsync(
        string? search,
        PromotionDiscountType? discountType,
        PromotionScopeType? scopeType,
        bool? isActive,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _db.Promotions
            .Include(p => p.Scopes)
            .AsQueryable();

        var normalizedSearch = string.IsNullOrWhiteSpace(search)
            ? null
            : search.Trim().ToUpperInvariant();
        if (!string.IsNullOrWhiteSpace(normalizedSearch))
            query = query.Where(p => p.NormalizedPromoCode.Contains(normalizedSearch));

        if (discountType.HasValue)
            query = query.Where(p => p.DiscountType == discountType.Value);

        if (scopeType.HasValue)
            query = query.Where(p => p.ScopeType == scopeType.Value);

        if (isActive.HasValue)
            query = query.Where(p => p.IsActive == isActive.Value);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(p => p.CreatedAt)
            .ThenByDescending(p => p.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task<Promotion?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.Promotions.FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<Promotion?> GetByNormalizedCodeAsync(
        string normalizedCode, CancellationToken ct = default) =>
        await _db.Promotions
            .FirstOrDefaultAsync(p => p.NormalizedPromoCode == normalizedCode, ct);

    public async Task<Promotion?> GetActiveByNormalizedCodeAsync(
        string normalizedCode, CancellationToken ct = default) =>
        await _db.Promotions
            .FirstOrDefaultAsync(p =>
                p.NormalizedPromoCode == normalizedCode &&
                p.IsActive, ct);

    public async Task<int> CountOrdersUsingPromotionAsync(
        Guid promotionId, CancellationToken ct = default) =>
        await _db.Orders
            .IgnoreQueryFilters()
            .CountAsync(o =>
                o.PromotionId == promotionId &&
                !o.IsDeleted &&
                o.OrderStatus != OrderStatus.Cancelled, ct);

    public async Task<int> CountOrdersUsingPromotionByCustomerAsync(
        Guid promotionId, Guid customerId, CancellationToken ct = default) =>
        await _db.Orders
            .IgnoreQueryFilters()
            .CountAsync(o =>
                o.PromotionId == promotionId &&
                o.CustomerId == customerId &&
                !o.IsDeleted &&
                o.OrderStatus != OrderStatus.Cancelled, ct);

    public async Task AddAsync(Promotion promotion, CancellationToken ct = default) =>
        await _db.Promotions.AddAsync(promotion, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
