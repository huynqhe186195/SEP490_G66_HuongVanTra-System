using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class StockAdjustmentRequestRepository(InventoryDbContext _db) : IStockAdjustmentRequestRepository
{
    public Task<StockAdjustmentRequest?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.StockAdjustmentRequests
            .Include(r => r.Items)
            .ThenInclude(i => i.ExportSlip)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task<List<StockAdjustmentRequest>> GetListAsync(
        StockAdjustmentRequestStatus? status,
        Guid? requestedBy,
        string? search,
        CancellationToken ct = default)
    {
        var query = BuildListQuery(status, false, requestedBy, search);

        return await query
            .Include(r => r.Items)
            .ThenInclude(i => i.ExportSlip)
            .OrderByDescending(r => r.RequestedAt)
            .ToListAsync(ct);
    }

    public async Task<(List<StockAdjustmentRequest> Items, int TotalCount)> GetPagedAsync(
        StockAdjustmentRequestStatus? status,
        bool excludePending,
        Guid? requestedBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = BuildListQuery(status, excludePending, requestedBy, search);
        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Include(r => r.Items)
            .ThenInclude(i => i.ExportSlip)
            .OrderByDescending(r => r.RequestedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    private IQueryable<StockAdjustmentRequest> BuildListQuery(
        StockAdjustmentRequestStatus? status,
        bool excludePending,
        Guid? requestedBy,
        string? search)
    {
        var query = _db.StockAdjustmentRequests.AsQueryable();

        if (status.HasValue)
            query = query.Where(r => r.Status == status.Value);

        if (excludePending)
            query = query.Where(r => r.Status != StockAdjustmentRequestStatus.Pending);

        if (requestedBy.HasValue)
            query = query.Where(r => r.RequestedBy == requestedBy.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(r =>
                r.RequestCode.ToLower().Contains(keyword) ||
                r.Items.Any(i =>
                    i.SkuCode.ToLower().Contains(keyword) ||
                    i.SkuSnapshotName.ToLower().Contains(keyword)));
        }

        return query;
    }

    public Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default) =>
        _db.StockAdjustmentRequests.CountAsync(r => r.RequestedAt >= sinceUtc, ct);

    public async Task AddAsync(StockAdjustmentRequest request, CancellationToken ct = default) =>
        await _db.StockAdjustmentRequests.AddAsync(request, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
