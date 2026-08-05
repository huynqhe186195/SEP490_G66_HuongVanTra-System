namespace InventoryService.Application.DTOs.Responses;

public record PagedResponse<T>(
    List<T> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages,
    /// <summary>Số lượng theo trạng thái (cùng filter list, bỏ status). Key = status string.</summary>
    Dictionary<string, int>? StatusCounts = null);

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
    string StockHandlingMode,
    // POS-06 (KB2/KB3): phần chờ điều chuyển Kho thành phẩm → Kệ khi Thủ kho xác nhận.
    int WarehouseTransferQuantity = 0);

/// <summary>
/// POS-04 (truy vết giữ chỗ hai chiều): một dòng giữ chỗ tồn Kệ Hàng của đơn COD.
/// Chỉ <c>ReservationStatus = "Active"</c> tính vào tổng đang giữ theo SKU.
/// </summary>
public record CodStockReservationLineResponse(
    Guid SkuId,
    string? SkuCode,
    string SkuName,
    int OrderedQuantity,
    int ReservedQuantity,
    string ReservationStatus,
    DateTime? ReservedAt,
    DateTime? ReleasedAt,
    DateTime? DeductedAt);

/// <summary>
/// POS-04: toàn bộ giữ chỗ của một đơn — dùng cho màn hình chi tiết đơn COD.
/// </summary>
public record OrderCodReservationResponse(
    Guid OrderId,
    Guid? QueueId,
    string OrderCode,
    string QueueStatus,
    string OrderStockStatus,
    bool HasActiveReservation,
    int TotalActiveReservedQuantity,
    List<CodStockReservationLineResponse> Lines);

/// <summary>
/// POS-04: một đơn đang giữ chỗ SKU này — dùng cho màn hình chi tiết SKU/tồn kho.
/// Tên khách hàng là snapshot nhận từ OrderPlacedEvent, không truy vấn chéo database.
/// </summary>
public record SkuCodReservationOrderResponse(
    Guid OrderId,
    string OrderCode,
    string? CustomerSnapshotName,
    int ReservedQuantity,
    DateTime? ReservedAt,
    string OrderPaymentStatus,
    string QueueStatus,
    string ReservationStatus);

/// <summary>
/// POS-04: tổng hợp giữ chỗ đang hoạt động của một SKU.
/// <c>TotalActiveReservedQuantity</c> phải khớp <c>SkuStock.ReservedQuantity</c>.
/// </summary>
public record SkuCodReservationSummaryResponse(
    Guid SkuId,
    int TotalActiveReservedQuantity,
    int SkuStockReservedQuantity,
    List<SkuCodReservationOrderResponse> Orders);

/// <summary>
/// POS-04: một đơn trong danh sách đơn đang giữ chỗ (dùng cho filter "Có hàng đang giữ").
/// </summary>
public record ActiveCodReservationOrderResponse(
    Guid OrderId,
    string OrderCode,
    string? CustomerSnapshotName,
    string QueueStatus,
    string OrderPaymentStatus,
    int TotalActiveReservedQuantity,
    int ActiveReservedLineCount,
    DateTime? ReservedAt);

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
    bool IsBomReconciliation = false,
    // POS-06: chứng từ sẽ được sinh khi Thủ kho xác nhận — để màn hình preview mô tả trước.
    bool WillCreateProductionOrder = false,
    bool WillCreateStockTransfer = false);

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
    int PendingBomQuantity,
    int WarehouseDeductedQuantity = 0);

public record PosStockHandlingResponse(
    Guid OrderId,
    string OrderCode,
    string StockHandlingMode,
    bool HasPendingStockReconciliation,
    string Message,
    List<Guid> QueueIds,
    List<PosStockHandlingLineResponse> Lines,
    bool BackorderRequired = false,
    string? BackorderMessage = null);

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
    string? ExportSlipCode,
    int RequestedQuantity = 0,
    int ApprovedQuantity = 0,
    int FulfilledQuantity = 0,
    int RejectedQuantity = 0,
    int RemainingQuantity = 0,
    string Status = "pending",
    string? ReviewNote = null,
    string? RejectionReason = null,
    string? ClosedReason = null,
    // Availability tường minh cho màn hình "Tạo phiếu điều chuyển từ yêu cầu".
    // AvailableToTransferQuantity = ApprovedQuantity - FulfilledQuantity - DraftReservedQuantity.
    int DraftReservedQuantity = 0,
    int AvailableToTransferQuantity = 0);

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
    List<StockAdjustmentRequestItemResponse> Items,
    int TotalRequestedQuantity = 0,
    int TotalFulfilledQuantity = 0,
    int TotalRejectedQuantity = 0,
    int TotalRemainingQuantity = 0,
    // Ảnh chụp người tạo và người xử lý gần nhất, phục vụ màn hình audit của Admin.
    string? RequestedByName = null,
    string? RequestedByRoleName = null,
    string? ReviewedByName = null,
    string? ReviewedByRoleName = null,
    int TotalApprovedQuantity = 0,
    // Tổng số lượng còn có thể đưa vào phiếu điều chuyển mới của cả yêu cầu.
    int TotalAvailableToTransferQuantity = 0);

/// <summary>
/// Kết quả kiểm tra trùng SKU trước khi gửi Yêu cầu bổ sung Kệ Hàng.
/// Cho phép màn hình tạo yêu cầu chặn sớm thay vì để người dùng xác nhận rồi mới nhận lỗi.
/// </summary>
public record StockAdjustmentDuplicateCheckResponse(
    bool Blocking,
    bool Warning,
    string? Message,
    List<StockAdjustmentDuplicateSkuResponse> Duplicates);

public record StockAdjustmentDuplicateSkuResponse(
    Guid SkuId,
    string SkuCode,
    string SkuSnapshotName,
    Guid RequestId,
    string RequestCode,
    string RequestStatus,
    string LineStatus,
    DateTime RequestedAt,
    string? RequestedByName,
    int RemainingQuantity,
    bool IsUntouched);

/// <summary>Tùy chọn đổ vào bộ lọc của màn hình audit Yêu cầu bổ sung Kệ Hàng.</summary>
public record StockAdjustmentRequestFilterOptionsResponse(
    List<StockAdjustmentRequestCreatorOption> Creators,
    List<string> CreatorRoles);

public record StockAdjustmentRequestCreatorOption(
    Guid Id,
    string? Name,
    string? RoleName);

/// <summary>Tóm tắt một phiếu điều chuyển đã sinh ra từ một yêu cầu bổ sung Kệ Hàng.</summary>
public record StockAdjustmentRelatedTransferResponse(
    Guid TransferId,
    string TransferCode,
    string Status,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    string? CreatedByName,
    int TotalQuantity,
    List<StockAdjustmentRelatedTransferLineResponse> Lines);

public record StockAdjustmentRelatedTransferLineResponse(
    Guid LineId,
    Guid? SourceRequestLineId,
    Guid SkuId,
    string SkuCode,
    string SkuName,
    int Quantity);

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

public record StockTransferBatchAllocationResponse(
    Guid Id,
    Guid StockTransferLineId,
    Guid SourceWarehouseBatchId,
    Guid SourceWarehouseBatchItemId,
    Guid DestinationWarehouseBatchId,
    Guid DestinationWarehouseBatchItemId,
    int Quantity);

public record StockTransferLineResponse(
    Guid Id,
    Guid SkuId,
    string SkuCode,
    string SkuName,
    string? UnitName,
    int Quantity,
    DateTime CreatedAt,
    List<StockTransferBatchAllocationResponse> BatchAllocations,
    Guid? SourceRequestLineId = null);

public record StockTransferResponse(
    Guid TransferId,
    string TransferCode,
    string Status,
    string SourceLocation,
    string DestinationLocation,
    string? Note,
    Guid CreatedBy,
    string? CreatedByName,
    string? CreatedByRoleName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    Guid? CompletedBy,
    string? CompletedByName,
    string? CompletedByRoleName,
    DateTime? CompletedAt,
    Guid? CancelledBy,
    DateTime? CancelledAt,
    string? CancellationReason,
    Guid? ExportSlipId,
    string? ExportSlipCode,
    Guid? ImportSlipId,
    string? ImportSlipCode,
    int LineCount,
    int TotalQuantity,
    List<StockTransferLineResponse> Lines,
    Guid? SourceRequestId = null,
    string? SourceRequestCode = null,
    Guid? SourceSuggestionId = null,
    string? SourceSuggestionCode = null);

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
    string BatchCode,
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
    decimal DocumentQuantity,
    decimal ActualQuantity,
    decimal? LineAmount,
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
    Guid? SupplierId,
    string? SupplierName,
    string? SupplierCodeSnapshot,
    string? SupplierNameSnapshot,
    string? SupplierReference,
    string? SupplierDocumentNumber,
    DateTime? SupplierDocumentDate,
    string? DeliveredByName,
    string? OriginalDocumentReference,
    string WarehouseLocation,
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
    decimal TotalAmount,
    List<SupplierReceiptItemResponse> Items);

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
    Guid? SupplierReceiptId,
    string? SupplierReceiptCode,
    string? SupplierName,
    string? SupplierReference,
    string DefectReasonCode,
    string DefectReasonLabel,
    List<string> EvidenceImageUrls,
    string? Reason,
    string? Note,
    string Status,
    Guid CreatedBy,
    string? CreatedByName,
    string? CreatedByRoleName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int TotalQuantity,
    List<SupplierReturnRequestItemResponse> Items);

public record ReturnInspectionResponse(
    Guid Id,
    Guid ReturnId,
    string ReturnCode,
    Guid OrderId,
    string OrderCode,
    Guid SkuId,
    string SkuCode,
    string SkuSnapshotName,
    int Quantity,
    string Disposition,
    Guid? QuarantineBatchId,
    Guid? RestockBatchId,
    Guid? InspectedBy,
    DateTime? InspectedAt,
    string? InspectionNote,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record StocktakeReasonCodeResponse(
    string Code,
    string Label);

public record ShelfDayStocktakeStatusResponse(
    DateOnly Date,
    bool DayStartDone,
    bool DayEndDone,
    Guid? DayStartId,
    string? DayStartRequestCode,
    Guid? DayEndId,
    string? DayEndRequestCode);

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

public record ShelfReplenishmentSuggestionItemResponse(
    Guid Id,
    Guid SkuId,
    string SkuCode,
    string SkuSnapshotName,
    string? InventoryUnitSnapshot,
    int ShelfQuantityAtStocktake,
    int ShelfReservedAtStocktake,
    int ShelfLowStockThreshold,
    int WarehouseQuantityAtStocktake);

public record ShelfReplenishmentSuggestionResponse(
    Guid Id,
    string SuggestionCode,
    Guid SourceStocktakeRequestId,
    string SourceStocktakeCode,
    string Status,
    DateTime CreatedAt,
    Guid? HandledBy,
    string? HandledByName,
    string? HandledByRoleName,
    DateTime? HandledAt,
    string? HandledNote,
    int ItemCount,
    List<ShelfReplenishmentSuggestionItemResponse> Items);

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
    string SupplierCode,
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
    string SupplierCode,
    string Name,
    string? Phone,
    string? Email);

public record SupplierProductResponse(
    Guid Id,
    Guid SupplierId,
    string SupplierCodeSnapshot,
    string SupplierName,
    Guid SkuId,
    string SkuCodeSnapshot,
    string SkuNameSnapshot,
    string ProductTypeSnapshot,
    string InventoryUnitSnapshot,
    string? SupplierItemCode,
    string? SupplierItemName,
    decimal? QuotedPrice,
    int? MinimumOrderQuantity,
    int? LeadTimeDays,
    bool IsPrimarySource,
    string? Note,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record SupplierProductPriceHistoryResponse(
    Guid Id,
    Guid SupplierProductId,
    decimal? OldPrice,
    decimal? NewPrice,
    DateTime EffectiveDate,
    Guid? ChangedBy,
    string? ChangedByName,
    DateTime ChangedAt,
    string? Reason);

/// <summary>Kết quả một dòng import. Status: Success | Warning | Error.</summary>
public record SupplierProductImportRowResultResponse(
    int RowNumber,
    string? SkuCode,
    string Status,
    IReadOnlyList<string> Messages);

public record SupplierProductImportResultResponse(
    int TotalRows,
    int SuccessCount,
    int FailedCount,
    int WarningCount,
    IReadOnlyList<SupplierProductImportRowResultResponse> Rows);

