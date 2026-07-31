using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.Interfaces;

public interface IShelfReplenishmentSuggestionRepository
{
    Task<ShelfReplenishmentSuggestion?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<ShelfReplenishmentSuggestion?> GetBySourceStocktakeAsync(Guid stocktakeRequestId, CancellationToken ct = default);
    Task<bool> ExistsForStocktakeAsync(Guid stocktakeRequestId, CancellationToken ct = default);
    Task<(List<ShelfReplenishmentSuggestion> Items, int TotalCount)> GetPagedAsync(
        ShelfReplenishmentSuggestionStatus? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<int> CountOpenAsync(CancellationToken ct = default);
    Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default);
    Task AddAsync(ShelfReplenishmentSuggestion suggestion, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
