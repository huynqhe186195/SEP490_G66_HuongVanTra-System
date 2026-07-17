namespace InventoryService.Application.DTOs.Requests;

public record AdjustSkuStockRequest(int QuantityDelta);

public record AdjustWarehouseStockRequest(int QuantityDelta);

public record CancelStockDeductRequest(string? Reason);

public record PreparePosStockDeductionItemRequest(
    Guid SkuId,
    string? SkuSnapshotName,
    string? SkuSnapshotCode,
    int Quantity);

public record PreparePosStockDeductionRequest(
    Guid OrderId,
    string OrderCode,
    string OrderStatus,
    decimal TotalAmount,
    List<PreparePosStockDeductionItemRequest> Items);

public record UpdateLowStockThresholdRequest(
    int Threshold,
    string? Location = null,
    int? WarehouseLowStockThreshold = null,
    int? ShelfLowStockThreshold = null);

public record CreateStockAdjustmentRequestItem(
    Guid SkuId,
    string? SkuCode,
    string? SkuSnapshotName,
    int QuantityDelta);

public record CreateStockAdjustmentRequest(
    string? Reason,
    List<CreateStockAdjustmentRequestItem> Items);

public record RejectStockAdjustmentRequest(string? Reason);

public record CancelStockAdjustmentRequest(string? Reason);

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
    DateTime? ExpiresAt = null,
    string? DestinationLocation = null);

public record CreateProductionOrderRequest(
    string? Note,
    List<ProductionOrderOutputLineInput> OutputLines,
    List<ProductionOrderLineInput> Lines);

public record ReviewProductionOrderRequest(string? Reason);

public record DeductMaterialItem(Guid SkuId, int Quantity);

public record DeductMaterialsRequest(List<DeductMaterialItem> Items);

public record CreatorSnapshot(
    Guid CreatedById,
    string? CreatedByName,
    string? CreatedByRoleName);

public record SupplierReceiptItemRequest(
    Guid SkuId,
    string? SkuCode,
    string? SkuNameSnapshot,
    string? ProductTypeSnapshot,
    string? InventoryUnitSnapshot,
    string? SubmittedUnit,
    decimal SubmittedQuantity,
    decimal? UnitCost,
    string LotCode,
    DateTime? ManufacturedAt,
    DateTime? ExpiresAt,
    string? QualityNote);

public record UpsertSupplierReceiptRequest(
    string? SupplierName,
    string? SupplierReference,
    string? SupplierDocumentNumber,
    DateTime? SupplierDocumentDate,
    DateTime? ReceivedDate,
    string? Note,
    List<SupplierReceiptItemRequest> Items);

public record ReviewSupplierReceiptRequest(string? Reason);

public record InventoryReturnItemRequest(
    Guid SkuId,
    string? SkuCode,
    string? SkuSnapshotName,
    int Quantity,
    Guid? BatchId,
    string? LotCode,
    string? Note);

public record CreateShelfReturnRequest(
    string ReturnMode,
    Guid? OriginalStockAdjustmentRequestId,
    string? OriginalStockAdjustmentRequestCode,
    string? Reason,
    string? Note,
    List<InventoryReturnItemRequest> Items);

public record CreateSupplierReturnRequest(
    string ReturnMode,
    Guid? SupplierReceiptId,
    string? SupplierReceiptCode,
    string? SupplierName,
    string? SupplierReference,
    string? Reason,
    string? Note,
    List<InventoryReturnItemRequest> Items);

public record ReviewInventoryReturnRequest(string? Reason);

public record StocktakeItemRequest(
    Guid SkuId,
    string? SkuCode,
    string? SkuSnapshotName,
    int ActualQuantity,
    string ReasonCode,
    string? Note);

public record CreateStocktakeRequest(
    string Location,
    DateTime? CountDate,
    string? Reason,
    string? Note,
    List<StocktakeItemRequest> Items);

public record ReviewStocktakeRequest(string? Reason);
