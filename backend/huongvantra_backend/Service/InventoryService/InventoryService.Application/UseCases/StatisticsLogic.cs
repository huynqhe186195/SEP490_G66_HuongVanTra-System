using InventoryService.Application.DTOs.Responses;
using InventoryService.Application.Interfaces;

namespace InventoryService.Application.UseCases;

public class StatisticsLogic(
    ISkuStockRepository _skuRepo,
    IStockDeductQueueRepository _deductQueueRepo,
    IWarehouseBatchRepository _warehouseBatchRepo)
{
    public async Task<InventoryStatisticsResponse> GetStatisticsAsync(CancellationToken ct = default)
    {
        var skus = await _skuRepo.GetAllAsync(ct);
        
        var totalSkus = skus.Count;
        var totalStoreQuantity = skus.Sum(s => s.QuantityOnHand);
        var totalWarehouseQuantity = skus.Sum(s => s.WarehouseQuantityOnHand);
        var lowStockCount = skus.Count(s =>
            s.QuantityOnHand <= s.ShelfLowStockThreshold ||
            s.WarehouseQuantityOnHand <= s.WarehouseLowStockThreshold);

        var pendingQueueCount = await _deductQueueRepo.CountWaitingAsync(ct);
        var totalWarehouseValue = await _warehouseBatchRepo.CalculateTotalWarehouseValueAsync(ct);

        return new InventoryStatisticsResponse
        {
            TotalSkus = totalSkus,
            TotalStoreQuantity = totalStoreQuantity,
            TotalWarehouseQuantity = totalWarehouseQuantity,
            LowStockSkuCount = lowStockCount,
            PendingDeductQueueCount = pendingQueueCount,
            TotalWarehouseValue = totalWarehouseValue
        };
    }
}
