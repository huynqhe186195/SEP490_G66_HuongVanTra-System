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

public record CreateWarehouseBatchItemRequest(
    Guid SkuId,
    string? SkuCode,
    string? ProductSnapshotName,
    int Quantity,
    decimal? UnitCost);

public record CreateWarehouseBatchRequest(
    string LotCode,
    string? Supplier,
    DateTime? ExpiresAt,
    string? Note,
    List<CreateWarehouseBatchItemRequest> Items);
