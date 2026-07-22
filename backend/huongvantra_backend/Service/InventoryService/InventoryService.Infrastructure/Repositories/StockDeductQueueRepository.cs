using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class StockDeductQueueRepository(InventoryDbContext _db) : IStockDeductQueueRepository
{
    public Task<StockDeductQueue?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.StockDeductQueues
            .Include(q => q.Items)
            .FirstOrDefaultAsync(q => q.Id == id, ct);

    public Task<StockDeductQueue?> GetByOrderIdAsync(Guid orderId, CancellationToken ct = default) =>
        _db.StockDeductQueues
            .Include(q => q.Items)
            .FirstOrDefaultAsync(q => q.OrderId == orderId, ct);

    public async Task<List<StockDeductQueue>> GetWaitingAsync(string? status, string? search, CancellationToken ct = default)
    {
        var query = BuildWaitingQuery(status, search);

        return await query.OrderByDescending(q => q.CreatedAt).ToListAsync(ct);
    }

    public async Task<List<StockDeductQueue>> GetUnresolvedBomReconciliationQueuesAsync(
        Guid? excludeQueueId = null,
        CancellationToken ct = default)
    {
        var query = _db.StockDeductQueues
            .Include(q => q.Items)
            .Where(q =>
                !q.IsDeducted &&
                (q.QueueStatus == QueueStatus.Waiting || q.QueueStatus == QueueStatus.Insufficient) &&
                q.Items.Any(i =>
                    i.PendingBomQuantity != null &&
                    i.PendingBomQuantity > 0 &&
                    i.MaterialRequirementSnapshotJson != null));

        if (excludeQueueId.HasValue)
            query = query.Where(q => q.Id != excludeQueueId.Value);

        return await query.ToListAsync(ct);
    }

    public async Task<int> CountWaitingAsync(CancellationToken ct = default)
    {
        return await _db.StockDeductQueues
            .CountAsync(q => !q.IsDeducted &&
                (q.QueueStatus == QueueStatus.Waiting || q.QueueStatus == QueueStatus.Insufficient), ct);
    }

    public async Task<(List<StockDeductQueue> Items, int TotalCount)> GetWaitingPagedAsync(
        string? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = BuildWaitingQuery(status, search);
        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(q => q.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    private IQueryable<StockDeductQueue> BuildWaitingQuery(string? status, string? search)
    {
        var query = _db.StockDeductQueues
            .AsQueryable();

        var normalizedStatus = status?.Trim().ToLowerInvariant();
        query = normalizedStatus switch
        {
            "waiting" => query.Where(q => q.QueueStatus == QueueStatus.Waiting),
            "insufficient" => query.Where(q => q.QueueStatus == QueueStatus.Insufficient),
            "confirmed" => query.Where(q => q.QueueStatus == QueueStatus.Confirmed),
            "cancelled" or "canceled" => query.Where(q => q.QueueStatus == QueueStatus.Cancelled),
            _ => query
        };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(q => q.OrderCode.ToLower().Contains(s));
        }

        return query;
    }

    public async Task AddAsync(StockDeductQueue queue, CancellationToken ct = default) =>
        await _db.StockDeductQueues.AddAsync(queue, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
