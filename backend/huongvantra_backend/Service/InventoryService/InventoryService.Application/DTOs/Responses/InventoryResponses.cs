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
    int LowStockThreshold,
    DateTime UpdatedAt);

public record StockAdjustmentRequestItemResponse(
    Guid Id,
    Guid SkuId,
    string SkuCode,
    string SkuSnapshotName,
    int QuantityDelta,
    int QuantityOnHandSnapshot,
    int? QuantityOnHandAfter,
    int? WarehouseQuantityOnHandAfter,
    Guid? ExportSlipId,
    string? ExportSlipCode);

public record StockAdjustmentRequestResponse(
    Guid Id,
    string RequestCode,
    string? Reason,
    string Status,
    Guid RequestedBy,
    DateTime RequestedAt,
    Guid? ReviewedBy,
    DateTime? ReviewedAt,
    string? ReviewNote,
    List<StockAdjustmentRequestItemResponse> Items);

public record StockAdjustmentExportSlipSummary(
    Guid ExportSlipId,
    string ExportSlipCode,
    Guid SkuId,
    string SkuCode);

public record StockAdjustmentReviewResponse(
    Guid Id,
    string RequestCode,
    string Status,
    DateTime? ReviewedAt,
    List<StockAdjustmentExportSlipSummary> ExportSlips);

public record StockExportBatchAllocationResponse(
    Guid Id,
    Guid? StockExportSlipLineId,
    Guid WarehouseBatchId,
    Guid WarehouseBatchItemId,
    string LotCode,
    string SkuCode,
    int Quantity);

public record StockExportSlipLineResponse(
    Guid Id,
    Guid SkuId,
    string SkuCode,
    string ProductSnapshotName,
    int Quantity,
    int WarehouseQtyBefore,
    int WarehouseQtyAfter,
    int StoreQtyBefore,
    int StoreQtyAfter,
    string? Note,
    DateTime CreatedAt,
    List<StockExportBatchAllocationResponse> BatchAllocations);

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
    string? SourceType,
    Guid? SourceReferenceId,
    string? SourceReferenceCode,
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
    Guid? ProductionOrderId,
    string? ProductionCode,
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
    Guid? CreatedById,
    string? CreatedByName,
    string? CreatedByRoleName,
    DateTime CreatedAt,
    List<StockExportBatchAllocationResponse> BatchAllocations,
    List<StockExportSlipLineResponse> Lines);

public record StockImportSlipLineResponse(
    Guid Id,
    Guid SkuId,
    string SkuCode,
    string ProductSnapshotName,
    int Quantity,
    int WarehouseQtyBefore,
    int WarehouseQtyAfter,
    int StoreQtyBefore,
    int StoreQtyAfter,
    Guid? WarehouseBatchId,
    string? WarehouseBatchLotCode,
    Guid? ProductionOrderOutputLineId,
    string? Note,
    DateTime CreatedAt);

public record StockImportSlipResponse(
    Guid Id,
    string ImportCode,
    string ImportType,
    Guid SkuId,
    string SkuCode,
    string ProductSnapshotName,
    int Quantity,
    int WarehouseQtyBefore,
    int WarehouseQtyAfter,
    int StoreQtyBefore,
    int StoreQtyAfter,
    Guid? WarehouseBatchId,
    string? WarehouseBatchLotCode,
    Guid? ProductionOrderId,
    string? ProductionCode,
    string? Note,
    Guid CreatedBy,
    Guid? CreatedById,
    string? CreatedByName,
    string? CreatedByRoleName,
    DateTime CreatedAt,
    List<StockImportSlipLineResponse> Lines);

public record ProductionOrderLineResponse(
    Guid Id,
    Guid MaterialSkuId,
    string MaterialSkuCode,
    string MaterialSnapshotName,
    int PlannedQuantity);

public record ProductionOrderOutputLineResponse(
    Guid Id,
    Guid FinishedSkuId,
    string FinishedSkuCode,
    string FinishedSkuSnapshotName,
    int Quantity,
    Guid? WarehouseBatchId,
    string? WarehouseBatchLotCode,
    DateTime CreatedAt);

public record ProductionOrderResponse(
    Guid Id,
    string ProductionCode,
    Guid FinishedSkuId,
    string FinishedSkuCode,
    string FinishedSkuSnapshotName,
    int Quantity,
    string? Note,
    string Status,
    Guid CreatedBy,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    List<ProductionOrderLineResponse> Lines,
    List<ProductionOrderOutputLineResponse> OutputLines);
