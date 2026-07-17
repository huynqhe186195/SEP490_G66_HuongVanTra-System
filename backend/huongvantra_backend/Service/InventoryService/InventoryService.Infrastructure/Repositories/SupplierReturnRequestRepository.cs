using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class SupplierReturnRequestRepository(InventoryDbContext _db) : ISupplierReturnRequestRepository
{
    private IQueryable<SupplierReturnRequest> WithItems() =>
        _db.SupplierReturnRequests.Include(r => r.Items);

    public Task<SupplierReturnRequest?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        WithItems().FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task<(List<SupplierReturnRequest> Items, int TotalCount)> GetPagedAsync(
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
                (r.SupplierReceiptCode != null && r.SupplierReceiptCode.ToLower().Contains(keyword)) ||
                (r.SupplierName != null && r.SupplierName.ToLower().Contains(keyword)) ||
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
        _db.SupplierReturnRequests.CountAsync(r => r.CreatedAt >= sinceUtc, ct);

    public async Task AddAsync(SupplierReturnRequest request, CancellationToken ct = default) =>
        await _db.SupplierReturnRequests.AddAsync(request, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
