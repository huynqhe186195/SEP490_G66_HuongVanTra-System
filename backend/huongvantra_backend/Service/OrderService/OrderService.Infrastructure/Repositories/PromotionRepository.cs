using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class PromotionRepository(OrderDbContext _db) : IPromotionRepository
{
    public async Task<List<Promotion>> GetAllAsync(CancellationToken ct = default) =>
        await _db.Promotions
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

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
            .CountAsync(o => o.PromotionId == promotionId, ct);

    public async Task AddAsync(Promotion promotion, CancellationToken ct = default) =>
        await _db.Promotions.AddAsync(promotion, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
