using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class ShelfReplenishmentSuggestionRepository(InventoryDbContext _db) : IShelfReplenishmentSuggestionRepository
{
    private IQueryable<ShelfReplenishmentSuggestion> WithItems() =>
        _db.ShelfReplenishmentSuggestions.Include(s => s.Items);

    public Task<ShelfReplenishmentSuggestion?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        WithItems().FirstOrDefaultAsync(s => s.Id == id, ct);

    public Task<ShelfReplenishmentSuggestion?> GetBySourceStocktakeAsync(Guid stocktakeRequestId, CancellationToken ct = default) =>
        WithItems().FirstOrDefaultAsync(s => s.SourceStocktakeRequestId == stocktakeRequestId, ct);

    public Task<bool> ExistsForStocktakeAsync(Guid stocktakeRequestId, CancellationToken ct = default) =>
        _db.ShelfReplenishmentSuggestions.AnyAsync(s => s.SourceStocktakeRequestId == stocktakeRequestId, ct);

    public async Task<(List<ShelfReplenishmentSuggestion> Items, int TotalCount)> GetPagedAsync(
        ShelfReplenishmentSuggestionStatus? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = WithItems().AsQueryable();

        if (status.HasValue)
            query = query.Where(s => s.Status == status.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(s =>
                s.SuggestionCode.ToLower().Contains(keyword) ||
                s.SourceStocktakeCode.ToLower().Contains(keyword) ||
                s.Items.Any(i =>
                    i.SkuCode.ToLower().Contains(keyword) ||
                    i.SkuSnapshotName.ToLower().Contains(keyword)));
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public Task<int> CountOpenAsync(CancellationToken ct = default) =>
        _db.ShelfReplenishmentSuggestions.CountAsync(
            s => s.Status == ShelfReplenishmentSuggestionStatus.Open, ct);

    public Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default) =>
        _db.ShelfReplenishmentSuggestions.CountAsync(s => s.CreatedAt >= sinceUtc, ct);

    public async Task AddAsync(ShelfReplenishmentSuggestion suggestion, CancellationToken ct = default) =>
        await _db.ShelfReplenishmentSuggestions.AddAsync(suggestion, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
