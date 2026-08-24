namespace InventoryService.Application.DTOs.Requests;

public record AdjustSkuStockRequest(int QuantityDelta);

public record AdjustWarehouseStockRequest(int QuantityDelta);

public record CancelStockDeductRequest(string? Reason);

/// <summary>OrderService gọi đồng bộ khi hủy đơn — hủy lệnh chờ trừ kho theo OrderId.</summary>
public record CancelStockQueuesForOrderRequest(
    Guid OrderId,
    string? Reason = null,
    string? PreviousOrderStatus = null);

public record FreezeStockQueuesForOrderRequest(Guid OrderId, string? Reason = null);

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
    List<PreparePosStockDeductionItemRequest> Items,
    bool AcceptBackorder = false,
    bool PreviewOnly = false,
    int BackorderMinLeadDays = 3,
    int BackorderMaxLeadDays = 5,
    string? FulfillmentPreference = null,
    /// <summary>
    /// COD: không trừ Kệ ngay — chỉ phân loại 3 kịch bản, reserve phần Kệ, tạo queue
    /// (WH transfer / BOM / backorder) giống POS.
    /// </summary>
    bool ReserveOnly = false,
    /// <summary>
    /// POS-06: kênh đơn hàng (POS/COD/...) để gắn vào queue và phiếu điều chuyển sinh ra.
    /// </summary>
    string? OrderChannel = null);

public record ReplaceCodReservationItemRequest(
    Guid SkuId,
    string? SkuSnapshotName,
    string? SkuSnapshotCode,
    int Quantity);

/// <summary>
/// POS-04 (H4): thay giữ chỗ tồn Kệ Hàng cho đơn COD đang sửa — reconcile tuyệt đối
/// queue items + ReservedQuantity theo danh sách mới, all-or-nothing.
/// <paramref name="OperationId"/> là idempotency key của một lần sửa đơn: cùng OperationId
/// gọi lại → no-op (đã xử lý).
/// </summary>
public record ReplaceCodReservationRequest(
    Guid OrderId,
    Guid OperationId,
    decimal TotalAmount,
    List<ReplaceCodReservationItemRequest> Items);

/// <summary>Ngưỡng tồn thấp Kho — chỉ Thủ kho được đặt.</summary>
public record UpdateWarehouseLowStockThresholdRequest(int Threshold);

/// <summary>Ngưỡng tồn thấp Kệ Hàng — chỉ Quản lý được đặt.</summary>
public record UpdateShelfLowStockThresholdRequest(int Threshold);

public record CreateStockAdjustmentRequestItem(
    Guid SkuId,
    string? SkuCode,
    string? SkuSnapshotName,
    int QuantityDelta);

/// <summary>
/// AcknowledgeDuplicates được giữ lại để tương thích payload cũ nhưng không còn được sử dụng.
/// Mọi SKU còn dòng yêu cầu chưa kết thúc đều bị chặn tạo lại.
/// </summary>
public record CreateStockAdjustmentRequest(
    string? Reason,
    List<CreateStockAdjustmentRequestItem> Items,
    bool AcknowledgeDuplicates = false);

/// <summary>Kiểm tra trùng SKU trước khi gửi yêu cầu, không tạo dữ liệu.</summary>
public record CheckStockAdjustmentDuplicatesRequest(List<Guid>? SkuIds);

public record CancelStockAdjustmentRequest(string? Reason);

public record UpsertStockTransferLineRequest(
    Guid SkuId,
    string? SkuCode,
    string? SkuName,
    string? UnitName,
    int Quantity,
    Guid? SourceRequestLineId = null);

public record UpsertStockTransferRequest(
    string? Note,
    List<UpsertStockTransferLineRequest> Lines,
    Guid? SourceRequestId = null,
    Guid? SourceSuggestionId = null);

public record CancelStockTransferRequest(string? Reason);

public record DismissShelfReplenishmentSuggestionRequest(string? Reason);

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

public record DeductMaterialItem(
    Guid SkuId,
    int Quantity,
    string? SkuCode = null,
    string? SkuName = null);

public record DeductMaterialsRequest(
    List<DeductMaterialItem> Items,
    string? ReferenceType = null,
    Guid? ReferenceId = null,
    string? ReferenceCode = null,
    string? Note = null,
    /// <summary>Tên gói sản phẩm cá nhân — hiển thị trên lệnh sản xuất đầu ra.</summary>
    string? CustomBundleLabel = null,
    Guid? SourceOrderId = null,
    string? SourceOrderChannel = null);

/// <summary>
/// Kiểm tra tồn Kho NL/bao bì cho gói custom lúc tạo đơn POS/COD (sell-first).
/// Không trừ tồn — trừ khi đóng gói (DeductMaterials).
/// </summary>
public record PrepareCustomMaterialsRequest(
    Guid OrderId,
    string OrderCode,
    List<PreparePosStockDeductionItemRequest> Items,
    bool AcceptBackorder = false,
    bool PreviewOnly = false,
    int BackorderMinLeadDays = 3,
    int BackorderMaxLeadDays = 5);

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
    string? QualityNote,
    decimal? DocumentQuantity = null,
    decimal? ActualQuantity = null);

public record UpsertSupplierReceiptRequest(
    Guid? SupplierId,
    string? SupplierName,
    string? SupplierReference,
    string? SupplierDocumentNumber,
    DateTime? SupplierDocumentDate,
    DateTime? ReceivedDate,
    string? Note,
    List<SupplierReceiptItemRequest> Items,
    string? DeliveredByName = null,
    string? OriginalDocumentReference = null);

public record ReviewSupplierReceiptRequest(string? Reason);

public record InventoryReturnItemRequest(
    Guid SkuId,
    string? SkuCode,
    string? SkuSnapshotName,
    int Quantity,
    Guid? BatchId,
    string? LotCode,
    string? Note);

/// <summary>
/// Trả hàng nhập (Kho → NCC) là thao tác một bước: Thủ kho tạo và tồn Kho bị trừ ngay.
/// <paramref name="OperationId"/> là idempotency key của một lần bấm gửi — gọi lại cùng key
/// trả về phiếu đã tạo thay vì trừ kho lần nữa.
/// </summary>
public record CreateSupplierReturnRequest(
    Guid OperationId,
    Guid SupplierReceiptId,
    string? SupplierReceiptCode,
    string? SupplierName,
    string? SupplierReference,
    string DefectReasonCode,
    List<string> EvidenceImageUrls,
    string? Reason,
    string? Note,
    List<InventoryReturnItemRequest> Items);

public record SupplierReturnDefectReasonResponse(string Code, string Label);

public record InspectReturnRequest(string Disposition, string? Note);

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

public record CreateSupplierRequest(
    string Name,
    string? Phone,
    string? Email,
    string? Address,
    string? Note,
    string? SupplierCode = null,
    string? TaxCode = null,
    string? PaymentTerms = null);

public record UpdateSupplierRequest(
    string Name,
    string? Phone,
    string? Email,
    string? Address,
    string? Note,
    string? SupplierCode = null,
    string? TaxCode = null,
    string? PaymentTerms = null);

public record CreateSupplierProductRequest(
    Guid SkuId,
    string? SupplierItemCode,
    string? SupplierItemName,
    decimal? QuotedPrice,
    int? MinimumOrderQuantity,
    int? LeadTimeDays,
    bool IsPrimarySource = false,
    string? Note = null);

/// <summary>Không chứa QuotedPrice: đổi giá đi qua endpoint riêng để luôn ghi được lịch sử.</summary>
public record UpdateSupplierProductRequest(
    string? SupplierItemCode,
    string? SupplierItemName,
    int? MinimumOrderQuantity,
    int? LeadTimeDays,
    bool IsPrimarySource = false,
    string? Note = null);

public record UpdateSupplierProductPriceRequest(
    decimal? QuotedPrice,
    DateTime? EffectiveDate = null,
    string? Reason = null);

/// <summary>
/// Một dòng Excel import danh mục hàng cung ứng. Client đã tra <c>SkuId</c> từ danh mục SKU
/// được phép nhập; <c>SkuCode</c> chỉ để echo lại trong thông báo lỗi cho người dùng đọc được.
/// <c>RowNumber</c> giữ nguyên số dòng trong file Excel để báo lỗi đúng chỗ.
/// </summary>
public record ImportSupplierProductRow(
    int RowNumber,
    Guid SkuId,
    string? SkuCode,
    string? SupplierItemCode,
    string? SupplierItemName,
    decimal? QuotedPrice,
    bool IsPrimarySource = false,
    string? Note = null);

public record ImportSupplierProductsRequest(
    List<ImportSupplierProductRow> Rows);

/// <summary>
/// OrderService gọi để đồng bộ OrderStatus resolved vào queue sau khi resolve
/// WaitingTransfer/WaitingProduction/WaitingMaterials.
/// </summary>
public record UpdateQueueOrderStatusRequest(string OrderStatus);

