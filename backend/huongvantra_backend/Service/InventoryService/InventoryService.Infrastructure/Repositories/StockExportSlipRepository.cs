using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class StockExportSlipRepository(InventoryDbContext _db) : IStockExportSlipRepository
{
    public Task<StockExportSlip?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.StockExportSlips
            .Include(s => s.BatchAllocations)
            .Include(s => s.Lines)
                .ThenInclude(l => l.BatchAllocations)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task<List<StockExportSlip>> GetListAsync(string? search, CancellationToken ct = default)
    {
        var query = _db.StockExportSlips
            .Include(s => s.BatchAllocations)
            .Include(s => s.Lines)
                .ThenInclude(l => l.BatchAllocations)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(s =>
                s.ExportCode.ToLower().Contains(keyword) ||
                (s.ProductionCode != null && s.ProductionCode.ToLower().Contains(keyword)) ||
                s.SkuCode.ToLower().Contains(keyword) ||
                s.SkuSnapshotName.ToLower().Contains(keyword) ||
                s.Lines.Any(l =>
                    l.SkuCode.ToLower().Contains(keyword) ||
                    l.ProductSnapshotName.ToLower().Contains(keyword)));
        }

        return await query
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);
    }

    public Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default) =>
        _db.StockExportSlips.CountAsync(s => s.CreatedAt >= sinceUtc, ct);

    public async Task AddAsync(StockExportSlip slip, CancellationToken ct = default) =>
        await _db.StockExportSlips.AddAsync(slip, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
