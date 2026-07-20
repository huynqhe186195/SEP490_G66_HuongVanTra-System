namespace ProductService.Application.Interfaces;

public record InventoryProductDeletionValidationRequest(List<Guid> SkuIds);

public record InventorySkuDeletionValidationResult(
    Guid SkuId,
    string? SkuCode,
    int WarehouseQuantityOnHand,
    int QuantityOnHand,
    int ActiveProductionOrderCount,
    int PendingStockDeductQueueCount,
    int PendingStockAdjustmentRequestCount,
    List<string> BlockingReasons);

public record InventoryProductDeletionValidationResponse(
    List<InventorySkuDeletionValidationResult> Items);

public interface IInventoryProductDeletionValidationClient
{
    Task<InventoryProductDeletionValidationResponse> ValidateAsync(
        List<Guid> skuIds,
        string? bearerToken,
        CancellationToken ct = default);
}
