using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class ReturnInspectionRepository(InventoryDbContext _db) : IReturnInspectionRepository
{
    private IQueryable<ReturnInspection> Base() =>
        _db.ReturnInspections.Include(r => r.QuarantineBatch);

    public Task<ReturnInspection?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        Base().FirstOrDefaultAsync(r => r.Id == id, ct);

    public Task<List<ReturnInspection>> GetByReturnIdAsync(Guid returnId, CancellationToken ct = default) =>
        Base().Where(r => r.ReturnId == returnId).OrderBy(r => r.SkuCode).ToListAsync(ct);

    public async Task<(List<ReturnInspection> Items, int TotalCount)> GetPagedAsync(
        string? disposition, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        var query = Base().AsQueryable();

        if (!string.IsNullOrWhiteSpace(disposition)
            && Enum.TryParse<ReturnInspectionDisposition>(disposition, ignoreCase: true, out var d))
            query = query.Where(r => r.Disposition == d);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var kw = search.Trim().ToLower();
            query = query.Where(r =>
                r.ReturnCode.ToLower().Contains(kw) ||
                r.OrderCode.ToLower().Contains(kw) ||
                r.SkuCode.ToLower().Contains(kw) ||
                r.SkuSnapshotName.ToLower().Contains(kw));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
        return (items, total);
    }

    public Task<bool> ExistsByReturnAndSkuAsync(Guid returnId, Guid skuId, CancellationToken ct = default) =>
        _db.ReturnInspections.AnyAsync(r => r.ReturnId == returnId && r.SkuId == skuId, ct);

    public async Task AddAsync(ReturnInspection inspection, CancellationToken ct = default) =>
        await _db.ReturnInspections.AddAsync(inspection, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
