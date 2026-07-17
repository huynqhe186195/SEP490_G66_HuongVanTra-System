using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class ShelfReturnRequestRepository(InventoryDbContext _db) : IShelfReturnRequestRepository
{
    private IQueryable<ShelfReturnRequest> WithItems() =>
        _db.ShelfReturnRequests.Include(r => r.Items);

    public Task<ShelfReturnRequest?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        WithItems().FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task<(List<ShelfReturnRequest> Items, int TotalCount)> GetPagedAsync(
        InventoryReturnRequestStatus? status,
        Guid? createdBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = WithItems().AsQueryable();
        if (status.HasValue)
            query = query.Where(r => r.Status == status.Value);
        if (createdBy.HasValue)
            query = query.Where(r => r.CreatedBy == createdBy.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(r =>
                r.ReturnCode.ToLower().Contains(keyword) ||
                (r.OriginalStockAdjustmentRequestCode != null && r.OriginalStockAdjustmentRequestCode.ToLower().Contains(keyword)) ||
                r.Items.Any(i =>
                    i.SkuCode.ToLower().Contains(keyword) ||
                    i.SkuSnapshotName.ToLower().Contains(keyword) ||
                    (i.ShelfLotCode != null && i.ShelfLotCode.ToLower().Contains(keyword))));
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
        _db.ShelfReturnRequests.CountAsync(r => r.CreatedAt >= sinceUtc, ct);

    public async Task AddAsync(ShelfReturnRequest request, CancellationToken ct = default) =>
        await _db.ShelfReturnRequests.AddAsync(request, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
