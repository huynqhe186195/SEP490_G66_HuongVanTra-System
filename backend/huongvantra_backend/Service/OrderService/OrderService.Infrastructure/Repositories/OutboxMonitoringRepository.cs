using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

/// <summary>
/// G7 — triển khai <see cref="IOutboxMonitoringRepository"/> đọc/giám sát Outbox trên MySQL.
/// Truy vấn danh sách/chi tiết dùng <c>AsNoTracking</c>; riêng retry thủ công cần tracking
/// nên <see cref="GetByIdAsync"/> trả entity đang được context theo dõi để cập nhật vòng đời.
/// </summary>
public sealed class OutboxMonitoringRepository(OrderDbContext _db) : IOutboxMonitoringRepository
{
    public async Task<(List<OutboxMessage> Items, int TotalCount)> GetPagedAsync(
        OutboxMessageStatus? status,
        string? eventType,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _db.OutboxMessages.AsNoTracking().AsQueryable();

        if (status is not null)
            query = query.Where(m => m.Status == status.Value);

        if (!string.IsNullOrWhiteSpace(eventType))
        {
            var term = eventType.Trim();
            query = query.Where(m => m.EventType.Contains(term));
        }

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(m => m.OccurredAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    // Tracking (không AsNoTracking) để RetryAsync có thể sửa trạng thái rồi SaveChanges.
    public Task<OutboxMessage?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.OutboxMessages.FirstOrDefaultAsync(m => m.Id == id, ct);

    public async Task<Dictionary<OutboxMessageStatus, int>> CountByStatusAsync(CancellationToken ct = default)
    {
        var grouped = await _db.OutboxMessages
            .AsNoTracking()
            .GroupBy(m => m.Status)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return grouped.ToDictionary(x => x.Key, x => x.Count);
    }

    public Task<int> SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);
}
