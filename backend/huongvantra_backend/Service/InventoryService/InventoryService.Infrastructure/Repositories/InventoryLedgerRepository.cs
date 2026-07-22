using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class InventoryLedgerRepository(InventoryDbContext _db) : IInventoryLedgerRepository
{
    public async Task<(List<InventoryLedgerEntry> Items, int TotalCount)> GetPagedAsync(
        string? search,
        Guid? skuId,
        string? location,
        string? transactionType,
        string? referenceCode,
        Guid? actorId,
        DateTime? fromUtc,
        DateTime? toUtc,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _db.InventoryLedgerEntries.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(e =>
                e.SkuCode.ToLower().Contains(keyword) ||
                e.SkuNameSnapshot.ToLower().Contains(keyword) ||
                (e.ReferenceCode != null && e.ReferenceCode.ToLower().Contains(keyword)) ||
                (e.LotCode != null && e.LotCode.ToLower().Contains(keyword)) ||
                (e.ActorName != null && e.ActorName.ToLower().Contains(keyword)));
        }

        if (skuId.HasValue)
            query = query.Where(e => e.SkuId == skuId.Value);
        if (!string.IsNullOrWhiteSpace(location))
            query = query.Where(e => e.Location == location.Trim());
        if (!string.IsNullOrWhiteSpace(transactionType))
            query = query.Where(e => e.TransactionType == transactionType.Trim());
        if (!string.IsNullOrWhiteSpace(referenceCode))
        {
            var code = referenceCode.Trim();
            query = query.Where(e => e.ReferenceCode != null && e.ReferenceCode.Contains(code));
        }
        if (actorId.HasValue)
            query = query.Where(e => e.ActorId == actorId.Value);
        if (fromUtc.HasValue)
            query = query.Where(e => e.OccurredAtUtc >= fromUtc.Value);
        if (toUtc.HasValue)
            query = query.Where(e => e.OccurredAtUtc <= toUtc.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(e => e.OccurredAtUtc)
            .ThenByDescending(e => e.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task AddRangeAsync(IEnumerable<InventoryLedgerEntry> entries, CancellationToken ct = default) =>
        await _db.InventoryLedgerEntries.AddRangeAsync(entries, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
