namespace InventoryService.Application.DTOs.Requests;

public record AdjustSkuStockRequest(int QuantityDelta);

public record AdjustWarehouseStockRequest(int QuantityDelta);

public record CancelStockDeductRequest(string? Reason);

public record UpdateLowStockThresholdRequest(int Threshold);

public record CreateStockAdjustmentRequestItem(
    Guid SkuId,
    string? SkuCode,
    string? SkuSnapshotName,
    int QuantityDelta);

public record CreateStockAdjustmentRequest(
    string? Reason,
    List<CreateStockAdjustmentRequestItem> Items);

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

public record ProductionOrderLineInput(
    Guid MaterialSkuId,
    string MaterialSkuCode,
    string MaterialSnapshotName,
    int PlannedQuantity);

public record ProductionOrderOutputLineInput(
    Guid FinishedSkuId,
    string FinishedSkuCode,
    string FinishedSkuSnapshotName,
    int PlannedQuantity,
    DateTime? ExpiresAt = null);

public record CreateProductionOrderRequest(
    string? Note,
    List<ProductionOrderOutputLineInput> OutputLines,
    List<ProductionOrderLineInput> Lines);

public record DeductMaterialItem(Guid SkuId, int Quantity);

public record DeductMaterialsRequest(List<DeductMaterialItem> Items);

public record CreatorSnapshot(
    Guid CreatedById,
    string? CreatedByName,
    string? CreatedByRoleName);
