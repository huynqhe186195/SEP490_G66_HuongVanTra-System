using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class SkuStockRepository(InventoryDbContext _db) : ISkuStockRepository
{
    public Task<SkuStock?> GetBySkuIdAsync(Guid skuId, CancellationToken ct = default) =>
        _db.SkuStocks.FirstOrDefaultAsync(s => s.SkuId == skuId, ct);

    public Task<List<SkuStock>> GetAllAsync(CancellationToken ct = default) =>
        _db.SkuStocks.OrderBy(s => s.SkuCode).ToListAsync(ct);

    public async Task AddAsync(SkuStock stock, CancellationToken ct = default) =>
        await _db.SkuStocks.AddAsync(stock, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
