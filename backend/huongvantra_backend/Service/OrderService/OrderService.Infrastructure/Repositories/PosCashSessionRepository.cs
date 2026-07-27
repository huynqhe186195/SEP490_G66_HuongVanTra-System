using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class PosCashSessionRepository(OrderDbContext _db) : IPosCashSessionRepository
{
    public async Task<PosCashSession?> GetOpenAsync(CancellationToken ct = default) =>
        await _db.PosCashSessions
            .Where(s => s.Status == PosCashSessionStatus.Open)
            .OrderByDescending(s => s.OpenedAt)
            .FirstOrDefaultAsync(ct);

    public async Task<PosCashSession?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.PosCashSessions.FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task<(List<PosCashSession> Items, int TotalCount)> GetPagedAsync(
        DateTime? fromUtc,
        DateTime? toUtcExclusive,
        PosCashSessionStatus? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.PosCashSessions.AsNoTracking().AsQueryable();

        if (fromUtc.HasValue)
            query = query.Where(s => s.OpenedAt >= fromUtc.Value);
        if (toUtcExclusive.HasValue)
            query = query.Where(s => s.OpenedAt < toUtcExclusive.Value);
        if (status.HasValue)
            query = query.Where(s => s.Status == status.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim();
            query = query.Where(s =>
                (s.OpenedByName != null && s.OpenedByName.Contains(keyword))
                || (s.ClosedByName != null && s.ClosedByName.Contains(keyword))
                || (s.ShiftLabel != null && s.ShiftLabel.Contains(keyword))
                || (s.Note != null && s.Note.Contains(keyword))
                || (s.VarianceNote != null && s.VarianceNote.Contains(keyword)));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(s => s.OpenedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task AddAsync(PosCashSession session, CancellationToken ct = default) =>
        await _db.PosCashSessions.AddAsync(session, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
