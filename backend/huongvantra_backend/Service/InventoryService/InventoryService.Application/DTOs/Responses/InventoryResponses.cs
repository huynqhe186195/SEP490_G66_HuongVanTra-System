namespace InventoryService.Application.DTOs.Responses;

public record PagedResponse<T>(
    List<T> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages);

public record StockDeductQueueResponse(
    Guid QueueId,
    Guid OrderId,
    string OrderCode,
    string QueueStatus,
    string OrderPaymentStatus,
    string OrderStockStatus,
    decimal TotalAmount,
    DateTime CreatedAt);

public record StockDeductPreviewItemResponse(
    Guid SkuId,
    Guid MaterialId,
    string MaterialName,
    int RequiredQuantity,
    int AvailableQuantity,
    int ShortageQuantity,
    string Status);

public record StockDeductPreviewResponse(
    Guid QueueId,
    Guid OrderId,
    string OrderCode,
    string QueueStatus,
    string OrderStockStatus,
    bool CanDeduct,
    List<StockDeductPreviewItemResponse> Items);

public record StockDeductConfirmResponse(
    Guid QueueId,
    Guid OrderId,
    string OrderCode,
    string QueueStatus,
    string OrderStockStatus,
    DateTime? ConfirmedAt);

public record SkuStockResponse(
    Guid SkuId,
    string SkuCode,
    int WeightInGrams,
    int QuantityOnHand,
    int WarehouseQuantityOnHand,
    DateTime UpdatedAt);

public record StockAdjustmentRequestResponse(
    Guid Id,
    string RequestCode,
    Guid SkuId,
    string SkuCode,
    string SkuSnapshotName,
    int QuantityDelta,
    string? Reason,
    string Status,
    int QuantityOnHandSnapshot,
    int? QuantityOnHandAfter,
    Guid RequestedBy,
    DateTime RequestedAt,
    Guid? ReviewedBy,
    DateTime? ReviewedAt,
    string? ReviewNote,
    Guid? ExportSlipId,
    string? ExportSlipCode);

public record StockAdjustmentReviewResponse(
    Guid Id,
    string RequestCode,
    string Status,
    int QuantityOnHandAfter,
    int WarehouseQuantityOnHandAfter,
    DateTime? ReviewedAt,
    Guid? ExportSlipId,
    string? ExportSlipCode);

public record StockExportBatchAllocationResponse(
    Guid Id,
    Guid WarehouseBatchId,
    Guid WarehouseBatchItemId,
    string LotCode,
    string SkuCode,
    int Quantity);

public record WarehouseBatchItemResponse(
    Guid Id,
    Guid SkuId,
    string SkuCode,
    string? ProductSnapshotName,
    int QuantityOnHand,
    int InitialQuantity,
    decimal? UnitCost);

public record WarehouseBatchResponse(
    Guid Id,
    string LotCode,
    string? Supplier,
    DateTime? ExpiresAt,
    string? Note,
    string Status,
    int TotalQuantityOnHand,
    int SkuLineCount,
    Guid CreatedBy,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<WarehouseBatchItemResponse> Items);

public record StockExportSlipResponse(
    Guid Id,
    string ExportCode,
    string ExportType,
    Guid? StockAdjustmentRequestId,
    string? StockAdjustmentRequestCode,
    Guid SkuId,
    string SkuCode,
    string SkuSnapshotName,
    int Quantity,
    int WarehouseQtyBefore,
    int WarehouseQtyAfter,
    int StoreQtyBefore,
    int StoreQtyAfter,
    string? Note,
    Guid CreatedBy,
    DateTime CreatedAt,
    List<StockExportBatchAllocationResponse> BatchAllocations);
