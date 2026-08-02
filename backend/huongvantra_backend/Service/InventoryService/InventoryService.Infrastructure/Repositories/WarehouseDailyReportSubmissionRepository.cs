using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public sealed class WarehouseDailyReportSubmissionRepository(InventoryDbContext db)
    : IWarehouseDailyReportSubmissionRepository
{
    public async Task AddAsync(WarehouseDailyReportSubmission entity, CancellationToken ct = default)
    {
        db.WarehouseDailyReportSubmissions.Add(entity);
        await db.SaveChangesAsync(ct);
    }

    public Task<WarehouseDailyReportSubmission?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.WarehouseDailyReportSubmissions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public Task<bool> ExistsByBusinessDateAsync(DateOnly businessDate, CancellationToken ct = default) =>
        db.WarehouseDailyReportSubmissions.AsNoTracking()
            .AnyAsync(x => x.BusinessDate == businessDate, ct);

    public async Task<(IReadOnlyList<WarehouseDailyReportSubmission> Items, int Total)> GetPagedAsync(
        DateOnly? businessDate,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.WarehouseDailyReportSubmissions.AsNoTracking().AsQueryable();
        if (businessDate.HasValue)
            query = query.Where(x => x.BusinessDate == businessDate.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.SentAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }
}
