using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class StockImportSlipRepository(InventoryDbContext _db) : IStockImportSlipRepository
{
    private IQueryable<StockImportSlip> WithLines() =>
        _db.StockImportSlips.Include(s => s.Lines);

    public Task<StockImportSlip?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        WithLines().FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task<List<StockImportSlip>> GetListAsync(string? search, CancellationToken ct = default)
    {
        var query = WithLines();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(s =>
                s.ImportCode.ToLower().Contains(keyword) ||
                (s.ProductionCode != null && s.ProductionCode.ToLower().Contains(keyword)) ||
                (s.WarehouseBatchLotCode != null && s.WarehouseBatchLotCode.ToLower().Contains(keyword)) ||
                s.SkuCode.ToLower().Contains(keyword) ||
                s.ProductSnapshotName.ToLower().Contains(keyword) ||
                s.Lines.Any(l =>
                    l.SkuCode.ToLower().Contains(keyword) ||
                    l.ProductSnapshotName.ToLower().Contains(keyword) ||
                    (l.WarehouseBatchLotCode != null && l.WarehouseBatchLotCode.ToLower().Contains(keyword))));
        }

        return await query
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);
    }

    public Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default) =>
        _db.StockImportSlips.CountAsync(s => s.CreatedAt >= sinceUtc, ct);

    public async Task AddAsync(StockImportSlip slip, CancellationToken ct = default) =>
        await _db.StockImportSlips.AddAsync(slip, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
