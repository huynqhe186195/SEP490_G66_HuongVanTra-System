using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class StockExportBatchAllocationRepository(InventoryDbContext _db) : IStockExportBatchAllocationRepository
{
    public Task<List<StockExportBatchAllocation>> GetByExportSlipIdAsync(Guid exportSlipId, CancellationToken ct = default) =>
        _db.StockExportBatchAllocations
            .Where(a => a.StockExportSlipId == exportSlipId)
            .OrderBy(a => a.LotCode)
            .ToListAsync(ct);

    public async Task AddRangeAsync(IEnumerable<StockExportBatchAllocation> allocations, CancellationToken ct = default) =>
        await _db.StockExportBatchAllocations.AddRangeAsync(allocations, ct);

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
