namespace InventoryService.Application.DTOs.Responses;

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
    DateTime CreatedAt);
