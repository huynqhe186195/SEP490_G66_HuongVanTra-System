using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Exceptions;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace InventoryService.Infrastructure.Repositories;

public sealed class WarehouseDailyReportSubmissionRepository(InventoryDbContext db)
    : IWarehouseDailyReportSubmissionRepository
{
    public async Task AddAsync(WarehouseDailyReportSubmission entity, CancellationToken ct = default)
    {
        db.WarehouseDailyReportSubmissions.Add(entity);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is MySqlException { Number: 1062 })
        {
            throw new InventoryValidationException(
                $"Báo cáo ngày {entity.BusinessDate:dd/MM/yyyy} đã được gửi. Mỗi ngày chỉ gửi một lần.");
        }
    }

    public Task<WarehouseDailyReportSubmission?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.WarehouseDailyReportSubmissions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public Task<bool> ExistsByBusinessDateAsync(DateOnly businessDate, CancellationToken ct = default) =>
        db.WarehouseDailyReportSubmissions.AsNoTracking()
            .AnyAsync(x => x.BusinessDate == businessDate, ct);

    public async Task<(IReadOnlyList<WarehouseDailyReportSubmission> Items, int Total)> GetPagedAsync(
        DateOnly? businessDateFrom,
        DateOnly? businessDateTo,
        string? sentByName,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.WarehouseDailyReportSubmissions.AsNoTracking().AsQueryable();

        if (businessDateFrom.HasValue)
            query = query.Where(x => x.BusinessDate >= businessDateFrom.Value);
        if (businessDateTo.HasValue)
            query = query.Where(x => x.BusinessDate <= businessDateTo.Value);

        if (!string.IsNullOrWhiteSpace(sentByName))
        {
            var keyword = sentByName.Trim().ToLowerInvariant();
            query = query.Where(x => x.SentByName.ToLower().Contains(keyword));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.BusinessDate)
            .ThenByDescending(x => x.SentAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }
}
