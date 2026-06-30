using InventoryService.Domain.Entities;

namespace InventoryService.Application.Interfaces;

public interface IWarehouseBatchRepository
{
    Task<WarehouseBatch?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<WarehouseBatch?> GetByLotCodeAsync(string lotCode, CancellationToken ct = default);
    Task<List<WarehouseBatch>> GetListAsync(Guid? skuId, string? search, bool availableOnly, CancellationToken ct = default);
    Task<List<WarehouseBatchItem>> GetAvailableItemsForSkuAsync(Guid skuId, CancellationToken ct = default);
    Task<bool> ExistsLotCodeAsync(string lotCode, Guid? excludeId = null, CancellationToken ct = default);
    Task<int> SumQuantityOnHandAsync(Guid skuId, CancellationToken ct = default);
    Task<decimal> CalculateMovingAverageCostAsync(Guid skuId, CancellationToken ct = default);
    Task<Dictionary<Guid, int>> GetQuantitySumsBySkuAsync(CancellationToken ct = default);
    Task<int> CountActiveLotsForSkuAsync(Guid skuId, CancellationToken ct = default);
    Task<decimal> CalculateTotalWarehouseValueAsync(CancellationToken ct = default);
    Task AddAsync(WarehouseBatch batch, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
