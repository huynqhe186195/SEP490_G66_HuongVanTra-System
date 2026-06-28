using InventoryService.Domain.Entities;

namespace InventoryService.Application.Interfaces;

public interface ISkuStockRepository
{
    Task<SkuStock?> GetBySkuIdAsync(Guid skuId, CancellationToken ct = default);
    Task<SkuStock?> GetBySkuIdWithLockAsync(Guid skuId, CancellationToken ct = default);
    Task<List<SkuStock>> GetAllAsync(CancellationToken ct = default);
    Task AddAsync(SkuStock stock, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
