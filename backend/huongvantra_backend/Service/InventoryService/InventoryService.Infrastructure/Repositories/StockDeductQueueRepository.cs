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
        // Chỉ queue Waiting mới giữ chỗ nguyên liệu. Queue Insufficient đã được xác nhận là
        // thiếu nguyên liệu nên phần thiếu của nó không được tính là "đang giữ chỗ" — nếu tính,
        // số thiếu bị cộng dồn và mọi đơn KB3 sau đó đều bị phân loại sai thành backorder.
        var query = _db.StockDeductQueues
            .Include(q => q.Items)
            .Where(q =>
                !q.IsDeducted &&
                q.QueueStatus == QueueStatus.Waiting &&
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

    public async Task<Dictionary<string, int>> CountWaitingByStatusAsync(string? search, CancellationToken ct = default)
    {
        var query = BuildWaitingQuery(null, search);
        var rows = await query
            .GroupBy(q => q.QueueStatus)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToListAsync(ct);
        return rows.ToDictionary(
            row => row.Status.ToString().ToLowerInvariant(),
            row => row.Count,
            StringComparer.OrdinalIgnoreCase);
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

    public Task<List<StockDeductQueue>> GetQueuesWithActiveReservationBySkuAsync(
        Guid skuId,
        CancellationToken ct = default) =>
        _db.StockDeductQueues
            .Include(q => q.Items)
            .Where(q => q.Items.Any(i =>
                i.SkuId == skuId && i.ReservationStatus == StockReservationStatus.Active))
            .OrderByDescending(q => q.CreatedAt)
            .AsNoTracking()
            .ToListAsync(ct);

    public async Task<(List<StockDeductQueue> Items, int TotalCount)> GetQueuesWithActiveReservationPagedAsync(
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _db.StockDeductQueues
            .Include(q => q.Items)
            .Where(q => q.Items.Any(i => i.ReservationStatus == StockReservationStatus.Active));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(q =>
                q.OrderCode.ToLower().Contains(s) ||
                (q.CustomerSnapshotName != null && q.CustomerSnapshotName.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(q => q.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public Task<List<Guid>> GetOrderIdsWithActiveReservationAsync(
        IReadOnlyCollection<Guid>? orderIds = null,
        CancellationToken ct = default)
    {
        var query = _db.StockDeductQueues
            .Where(q => q.Items.Any(i => i.ReservationStatus == StockReservationStatus.Active));

        if (orderIds != null && orderIds.Count > 0)
        {
            var ids = orderIds.ToList();
            query = query.Where(q => ids.Contains(q.OrderId));
        }

        return query.Select(q => q.OrderId).Distinct().ToListAsync(ct);
    }

    public Task<List<StockDeductQueue>> GetCancelledAfterShippingAsync(
        int take = 50,
        CancellationToken ct = default) =>
        _db.StockDeductQueues
            .Include(q => q.Items)
            .Where(q =>
                q.QueueStatus == QueueStatus.Cancelled
                && q.OrderStockStatus == "cancelled_after_shipping")
            .OrderByDescending(q => q.CancelledAt ?? q.CreatedAt)
            .Take(Math.Clamp(take, 1, 200))
            .ToListAsync(ct);
}
