using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.Interfaces;

public interface IStocktakeRequestRepository
{
    Task<StocktakeRequest?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<(List<StocktakeRequest> Items, int TotalCount)> GetPagedAsync(
        StocktakeStatus? status,
        string? location,
        Guid? createdBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<Dictionary<string, int>> CountByStatusAsync(
        string? location,
        Guid? createdBy,
        string? search,
        CancellationToken ct = default);
    Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default);
    Task<List<StocktakeRequest>> GetShelfDayMarkersAsync(DateTime countDate, CancellationToken ct = default);
    Task AddAsync(StocktakeRequest request, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
