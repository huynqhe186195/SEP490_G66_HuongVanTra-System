using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class StocktakeRequestRepository(InventoryDbContext _db) : IStocktakeRequestRepository
{
    private IQueryable<StocktakeRequest> WithItems() =>
        _db.StocktakeRequests
            .Include(r => r.Items)
            .ThenInclude(i => i.StockExportSlip)
            .Include(r => r.Items)
            .ThenInclude(i => i.StockImportSlip)
            .Include(r => r.Items)
            .ThenInclude(i => i.WarehouseBatch);

    public Task<StocktakeRequest?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        WithItems().FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task<(List<StocktakeRequest> Items, int TotalCount)> GetPagedAsync(
        StocktakeStatus? status,
        string? location,
        Guid? createdBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = WithItems().AsQueryable();

        if (status.HasValue)
            query = query.Where(r => r.Status == status.Value);
        if (!string.IsNullOrWhiteSpace(location))
            query = query.Where(r => r.Location == location.Trim());
        if (createdBy.HasValue)
            query = query.Where(r => r.CreatedBy == createdBy.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(r =>
                r.RequestCode.ToLower().Contains(keyword) ||
                (r.Reason != null && r.Reason.ToLower().Contains(keyword)) ||
                r.Items.Any(i =>
                    i.SkuCode.ToLower().Contains(keyword) ||
                    i.SkuSnapshotName.ToLower().Contains(keyword) ||
                    (i.WarehouseBatchLotCode != null && i.WarehouseBatchLotCode.ToLower().Contains(keyword))));
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default) =>
        _db.StocktakeRequests.CountAsync(r => r.CreatedAt >= sinceUtc, ct);

    public Task<List<StocktakeRequest>> GetShelfDayMarkersAsync(DateTime countDate, CancellationToken ct = default)
    {
        var day = countDate.Date;
        return _db.StocktakeRequests
            .AsNoTracking()
            .Where(r =>
                r.Location == "Shelf"
                && r.CountDate >= day
                && r.CountDate < day.AddDays(1)
                && (r.Status == StocktakeStatus.PendingApproval || r.Status == StocktakeStatus.Completed))
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task AddAsync(StocktakeRequest request, CancellationToken ct = default) =>
        await _db.StocktakeRequests.AddAsync(request, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
