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
            .Include(r => r.ExportSlip)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task<List<StockAdjustmentRequest>> GetListAsync(
        StockAdjustmentRequestStatus? status,
        Guid? requestedBy,
        string? search,
        CancellationToken ct = default)
    {
        var query = _db.StockAdjustmentRequests.AsQueryable();

        if (status.HasValue)
            query = query.Where(r => r.Status == status.Value);

        if (requestedBy.HasValue)
            query = query.Where(r => r.RequestedBy == requestedBy.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(r =>
                r.RequestCode.ToLower().Contains(keyword) ||
                r.SkuCode.ToLower().Contains(keyword) ||
                r.SkuSnapshotName.ToLower().Contains(keyword));
        }

        return await query
            .Include(r => r.ExportSlip)
            .OrderByDescending(r => r.RequestedAt)
            .ToListAsync(ct);
    }

    public Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default) =>
        _db.StockAdjustmentRequests.CountAsync(r => r.RequestedAt >= sinceUtc, ct);

    public async Task AddAsync(StockAdjustmentRequest request, CancellationToken ct = default) =>
        await _db.StockAdjustmentRequests.AddAsync(request, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
