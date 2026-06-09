namespace InventoryService.Application.DTOs.Requests;

public record AdjustSkuStockRequest(int QuantityDelta);

public record AdjustWarehouseStockRequest(int QuantityDelta);

public record CancelStockDeductRequest(string? Reason);

public record CreateStockAdjustmentRequest(
    Guid SkuId,
    string? SkuCode,
    string? SkuSnapshotName,
    int QuantityDelta,
    string? Reason);

public record RejectStockAdjustmentRequest(string? Reason);
