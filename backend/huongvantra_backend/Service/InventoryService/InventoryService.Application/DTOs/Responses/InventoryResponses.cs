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
    DateTime CreatedAt,
    DateTime? ConfirmedAt = null,
    string? ConfirmedByName = null,
    string? ConfirmedByRoleName = null,
    DateTime? CancelledAt = null,
    string? CancelledByName = null,
    string? CancelledByRoleName = null,
    string? CancelReason = null,
    DateTime? LastAttemptAt = null,
    string? LastShortageReason = null,
    List<StockDeductQueueLineResponse>? Lines = null,
    // POS-04 (H6): trạng thái giữ chỗ tồn Kệ Hàng của đơn COD chờ xác nhận.
    bool IsReserved = false);

public record StockDeductQueueLineResponse(
    Guid SkuId,
    string? SkuCode,
    string SkuName,
    int OrderedQuantity,
    int FinishedDeductedQuantity,
    int PendingBomQuantity,
    string StockHandlingMode);

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
    List<StockDeductPreviewItemResponse> Items,
    List<StockDeductQueueLineResponse>? Lines = null,
    bool IsBomReconciliation = false);

public record StockDeductConfirmResponse(
    Guid QueueId,
    Guid OrderId,
    string OrderCode,
    string QueueStatus,
    string OrderStockStatus,
    DateTime? ConfirmedAt,
    bool CanDeduct = true,
    List<StockDeductPreviewItemResponse>? Shortages = null,
    DateTime? CancelledAt = null,
    string? CancelReason = null);

public record PosStockHandlingLineResponse(
    Guid SkuId,
    string? SkuCode,
    string SkuName,
    int OrderedQuantity,
    int FinishedDeductedQuantity,
    int PendingBomQuantity);

public record PosStockHandlingResponse(
    Guid OrderId,
    string OrderCode,
    string StockHandlingMode,
    bool HasPendingStockReconciliation,
    string Message,
    List<Guid> QueueIds,
    List<PosStockHandlingLineResponse> Lines);

/// <summary>
/// POS-04 (H4): kết quả thay giữ chỗ tồn Kệ Hàng khi sửa đơn COD.
/// Replaced=false + AlreadyProcessed=true nghĩa là OperationId đã xử lý trước đó (no-op).
/// </summary>
public record ReplaceCodReservationResponse(
    Guid QueueId,
    Guid OrderId,
    string OrderCode,
    bool Replaced,
    bool AlreadyProcessed,
    string Message);

public record SkuStockResponse(
    Guid SkuId,
    string SkuCode,
    int WeightInGrams,
    int QuantityOnHand,
    int WarehouseQuantityOnHand,
    int LowStockThreshold,
    int WarehouseLowStockThreshold,
    int ShelfLowStockThreshold,
    DateTime UpdatedAt,
    // POS-04: tồn Kệ Hàng đang giữ chỗ cho đơn COD chờ xác nhận và tồn khả bán = OnHand - Reserved.
    int ReservedQuantity = 0,
    int AvailableQuantity = 0);

/// <summary>Response chỉ trả tồn quầy — dùng cho Admin/Manager (không expose thông tin kho tổng).</summary>
public record StoreSkuStockResponse(
    Guid SkuId,
    string SkuCode,
    int WeightInGrams,
    int QuantityOnHand,
    int WarehouseQuantityOnHand,
    int LowStockThreshold,
    int ShelfLowStockThreshold,
    DateTime UpdatedAt,
    // POS-04: tồn Kệ Hàng đang giữ chỗ và tồn khả bán = OnHand - Reserved.
    int ReservedQuantity = 0,
    int AvailableQuantity = 0);

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
    string Location,
    Guid? ParentBatchId,
    Guid? SourceBatchId,
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
    string? ReferenceType,
    Guid? ReferenceId,
    string? ReferenceCode,
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
    string? DestinationLocation,
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
    Guid? SupplierReceiptId,
    string? SupplierReceiptCode,
    string? ReferenceType,
    Guid? ReferenceId,
    string? ReferenceCode,
    string? Note,
    Guid CreatedBy,
    Guid? CreatedById,
    string? CreatedByName,
    string? CreatedByRoleName,
    DateTime CreatedAt,
    List<StockImportSlipLineResponse> Lines);

public record InventoryLedgerEntryResponse(
    Guid Id,
    Guid TransactionGroupId,
    DateTime OccurredAtUtc,
    Guid SkuId,
    string SkuCode,
    string SkuNameSnapshot,
    string? ProductTypeSnapshot,
    string? InventoryUnitSnapshot,
    string Location,
    int QuantityBefore,
    int QuantityDelta,
    int QuantityAfter,
    string TransactionType,
    string? SourceLocation,
    string? DestinationLocation,
    string? ReferenceType,
    Guid? ReferenceId,
    string? ReferenceCode,
    Guid? BatchId,
    string? LotCode,
    Guid? ActorId,
    string? ActorName,
    string? ActorRole,
    string? Reason,
    string? Note,
    string? CorrelationId);

public record SupplierReceiptItemResponse(
    Guid Id,
    Guid SkuId,
    string SkuCode,
    string SkuNameSnapshot,
    string ProductTypeSnapshot,
    string InventoryUnitSnapshot,
    string? SubmittedUnit,
    decimal SubmittedQuantity,
    int Quantity,
    decimal? UnitCost,
    string LotCode,
    DateTime? ManufacturedAt,
    DateTime? ExpiresAt,
    int ActualReceivedQuantity,
    string? QualityNote,
    Guid? WarehouseBatchId,
    string? WarehouseBatchLotCode,
    int? WarehouseQtyBefore,
    int? WarehouseQtyAfter,
    int? ShelfQtyBefore,
    int? ShelfQtyAfter);

public record SupplierReceiptResponse(
    Guid Id,
    string ReceiptCode,
    string? SupplierName,
    string? SupplierReference,
    string? SupplierDocumentNumber,
    DateTime? SupplierDocumentDate,
    DateTime ReceivedDate,
    string? Note,
    string Status,
    Guid CreatedBy,
    string? CreatedByName,
    string? CreatedByRoleName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    Guid? SubmittedBy,
    DateTime? SubmittedAt,
    Guid? ReviewedBy,
    string? ReviewedByName,
    string? ReviewedByRoleName,
    DateTime? ReviewedAt,
    string? ReviewNote,
    Guid? StockImportSlipId,
    string? StockImportSlipCode,
    int TotalQuantity,
    List<SupplierReceiptItemResponse> Items);

public record ShelfReturnRequestItemResponse(
    Guid Id,
    Guid SkuId,
    string SkuCode,
    string SkuSnapshotName,
    int Quantity,
    Guid? ShelfBatchId,
    string? ShelfLotCode,
    int? ShelfQtyBefore,
    int? ShelfQtyAfter,
    int? WarehouseQtyBefore,
    int? WarehouseQtyAfter,
    Guid? StockExportSlipId,
    string? StockExportSlipCode,
    Guid? StockImportSlipId,
    string? StockImportSlipCode,
    Guid? WarehouseBatchId,
    string? WarehouseBatchLotCode,
    string? Note);

public record ShelfReturnRequestResponse(
    Guid Id,
    string ReturnCode,
    string ReturnMode,
    Guid? OriginalStockAdjustmentRequestId,
    string? OriginalStockAdjustmentRequestCode,
    string? Reason,
    string? Note,
    string Status,
    Guid CreatedBy,
    string? CreatedByName,
    string? CreatedByRoleName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    Guid? ReviewedBy,
    string? ReviewedByName,
    string? ReviewedByRoleName,
    DateTime? ReviewedAt,
    string? ReviewNote,
    int TotalQuantity,
    List<ShelfReturnRequestItemResponse> Items);

public record SupplierReturnRequestItemResponse(
    Guid Id,
    Guid SkuId,
    string SkuCode,
    string SkuSnapshotName,
    int Quantity,
    Guid? WarehouseBatchId,
    string? WarehouseBatchLotCode,
    int? WarehouseQtyBefore,
    int? WarehouseQtyAfter,
    int? ShelfQtyBefore,
    int? ShelfQtyAfter,
    Guid? StockExportSlipId,
    string? StockExportSlipCode,
    string? Note);

public record SupplierReturnRequestResponse(
    Guid Id,
    string ReturnCode,
    string ReturnMode,
    Guid? SupplierReceiptId,
    string? SupplierReceiptCode,
    string? SupplierName,
    string? SupplierReference,
    string? Reason,
    string? Note,
    string Status,
    Guid CreatedBy,
    string? CreatedByName,
    string? CreatedByRoleName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    Guid? ReviewedBy,
    string? ReviewedByName,
    string? ReviewedByRoleName,
    DateTime? ReviewedAt,
    string? ReviewNote,
    int TotalQuantity,
    List<SupplierReturnRequestItemResponse> Items);

public record StocktakeReasonCodeResponse(
    string Code,
    string Label);

public record StocktakeRequestItemResponse(
    Guid Id,
    Guid SkuId,
    string SkuCode,
    string SkuSnapshotName,
    string? ProductTypeSnapshot,
    string? InventoryUnitSnapshot,
    int SystemQuantitySnapshot,
    int ActualQuantity,
    int Variance,
    string ReasonCode,
    string? Note,
    int? WarehouseQtyBefore,
    int? WarehouseQtyAfter,
    int? ShelfQtyBefore,
    int? ShelfQtyAfter,
    Guid? StockExportSlipId,
    string? StockExportSlipCode,
    Guid? StockImportSlipId,
    string? StockImportSlipCode,
    Guid? WarehouseBatchId,
    string? WarehouseBatchLotCode);

public record StocktakeRequestResponse(
    Guid Id,
    string RequestCode,
    string Location,
    DateTime CountDate,
    string? Reason,
    string? Note,
    string Status,
    Guid CreatedBy,
    string? CreatedByName,
    string? CreatedByRoleName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    Guid? SubmittedBy,
    DateTime? SubmittedAt,
    Guid? ReviewedBy,
    string? ReviewedByName,
    string? ReviewedByRoleName,
    DateTime? ReviewedAt,
    string? ReviewNote,
    int TotalPositiveVariance,
    int TotalNegativeVariance,
    int TotalAbsoluteVariance,
    List<StocktakeRequestItemResponse> Items);

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
    int PlannedQuantity,
    DateTime? ExpiresAt,
    string DestinationLocation,
    Guid? WarehouseBatchId,
    string? WarehouseBatchLotCode,
    DateTime CreatedAt);

public record ProductionOrderResponse(
    Guid Id,
    string ProductionCode,
    string? Note,
    string Status,
    Guid CreatedBy,
    string? CreatedByName,
    string? CreatedByRoleName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    Guid? SubmittedBy,
    DateTime? SubmittedAt,
    Guid? ReviewedBy,
    string? ReviewedByName,
    string? ReviewedByRoleName,
    DateTime? ReviewedAt,
    string? ReviewNote,
    DateTime? CompletedAt,
    List<ProductionOrderLineResponse> Lines,
    List<ProductionOrderOutputLineResponse> OutputLines);

public record SupplierResponse(
    Guid Id,
    string Name,
    string? Phone,
    string? Email,
    string? Address,
    string? Note,
    bool IsDeleted,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int TotalReceiptCount,
    decimal TotalReceiptValue);

public record SupplierSimpleResponse(
    Guid Id,
    string Name,
    string? Phone,
    string? Email);
