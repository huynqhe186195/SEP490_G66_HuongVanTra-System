using OrderService.Domain.Enums;

namespace OrderService.Application.DTOs.Responses;

public record OrderActivityResponse(
    Guid Id,
    Guid OrderId,
    string ActivityType,
    string Description,
    Guid? ActorId,
    string? ActorName,
    DateTime CreatedAt
);

public record OrderResponse(
    Guid Id,
    string OrderCode,
    Guid? CustomerId,
    string? CustomerSnapshotName,
    Guid? EmployeeId,
    string? EmployeeSnapshotName,
    string OrderChannel,
    string OrderKind,
    string OrderStatus,
    string InventorySyncStatus,
    decimal TotalAmount,
    decimal DiscountAmount,
    Guid? PromotionId,
    string? PromotionCode,
    decimal PromotionDiscountAmount,
    decimal FinalAmount,
    string? ShippingAddress,
    string? Note,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<OrderDetailResponse> Items,
    List<PaymentResponse> Payments,
    List<CustomBundleResponse>? CustomBundles = null,
    StockHandlingSummaryResponse? StockHandlingSummary = null,
    Guid? ContractId = null,
    string? ContractCodeSnapshot = null,
    decimal? ContractDiscountPercentSnapshot = null,
    int? ContractPaymentTermDaysSnapshot = null,
    DateTime? DueDate = null,
    DateTime? BackorderAcceptedAt = null,
    int? BackorderMinLeadDaysSnapshot = null,
    int? BackorderMaxLeadDaysSnapshot = null,
    DateTime? EstimatedReadyFrom = null,
    DateTime? EstimatedReadyTo = null,
    string? FulfillmentPreference = null,
    string RefundStatus = "NotRequired",
    decimal? RefundAmount = null,
    string? RefundMethod = null,
    string? RefundEvidence = null,
    string? CancellationReason = null,
    DateTime? CancellationRequestedAt = null,
    Guid? CancellationRequestedBy = null,
    string? CancellationRequestedByName = null,
    DateTime? RefundApprovedAt = null,
    Guid? RefundApprovedBy = null,
    string? RefundApprovedByName = null,
    DateTime? RefundedAt = null,
    Guid? RefundedBy = null,
    string? RefundedByName = null,
    DateTime? PickupDate = null,
    string? PickupNote = null,
    DateTime? DeliveredAt = null,
    string? DeliveredByName = null,
    string? PickupContactName = null,
    string? PickupContactPhone = null,
    string? PickupCode = null,
    decimal? DepositAmount = null,
    decimal? RemainingAmountDue = null
);

public record StockHandlingLineResponse(    Guid SkuId,
    string? SkuCode,
    string SkuName,
    int OrderedQuantity,
    int FinishedDeductedQuantity,
    int PendingBomQuantity,
    int WarehouseDeductedQuantity = 0);

public record StockHandlingSummaryResponse(
    bool HasPendingStockReconciliation,
    string StockHandlingMode,
    string Message,
    List<StockHandlingLineResponse> Lines);

public record OrderDetailResponse(
    Guid Id,
    Guid SkuId,
    string SkuSnapshotName,
    string? SkuSnapshotCode,
    int Quantity,
    int ReturnedQuantity,
    decimal UnitPrice,
    decimal SubTotal,
    bool IsGift,
    int ImmediateFulfilledQuantity = 0,
    int ReservedFinishedQuantity = 0,
    int BackorderQuantity = 0
);

public record ReturnOrderResponse(
    Guid ReturnId,
    string ReturnCode,
    Guid SourceOrderId,
    string SourceOrderCode,
    decimal ReturnAmount,
    decimal ExchangeAmount,
    decimal NetCustomerPays,
    decimal RefundAmount,
    Guid? ExchangeOrderId,
    string? ExchangeOrderCode,
    string AcceptanceStatus = "Accepted",
    DateTime? AcceptedAt = null
);

public record ReturnOrderLineResponse(
    Guid Id,
    Guid SkuId,
    string SkuSnapshotName,
    string? SkuSnapshotCode,
    int ReturnQuantity,
    decimal UnitPrice,
    decimal SubTotal);

public record ReturnOrderDetailResponse(
    Guid Id,
    string ReturnCode,
    Guid SourceOrderId,
    string SourceOrderCode,
    string SourceOrderChannel,
    Guid? CustomerId,
    string? CustomerSnapshotName,
    decimal ReturnAmount,
    decimal ExchangeAmount,
    decimal NetCustomerPays,
    decimal RefundAmount,
    decimal CustomerPaidAmount,
    string RefundMethod,
    Guid? ExchangeOrderId,
    string? ExchangeOrderCode,
    string? Note,
    DateTime CreatedAt,
    List<ReturnOrderLineResponse> Items,
    string AcceptanceStatus = "Accepted",
    DateTime? AcceptedAt = null,
    DateTime? RejectedAt = null,
    string? RejectionReason = null,
    bool AcceptedBySystem = false,
    bool ManagerOverride = false,
    string? PolicyCode = null,
    int? PolicyVersion = null,
    IReadOnlyList<string>? EvidenceImageUrls = null);

public record ReturnOrderSummaryResponse(
    Guid Id,
    string ReturnCode,
    Guid SourceOrderId,
    string SourceOrderCode,
    string SourceOrderChannel,
    Guid? CustomerId,
    string? CustomerSnapshotName,
    decimal ReturnAmount,
    decimal RefundAmount,
    decimal ExchangeAmount,
    Guid? ExchangeOrderId,
    string? ExchangeOrderCode,
    DateTime CreatedAt,
    string? Note = null,
    string AcceptanceStatus = "Accepted",
    DateTime? AcceptedAt = null);

public record PaymentResponse(
    Guid Id,
    Guid OrderId,
    string? OrderCode,
    string? CustomerSnapshotName,
    string PaymentMethod,
    decimal Amount,
    string PaymentStatus,
    string? TransactionRef,
    bool IsCodVerified,
    DateTime? CodWarningDate,
    DateTime? PaidAt,
    string? CodDebtSettlementJson = null,
    string PaymentPurpose = "Full"
);

public record OrderSummaryResponse(
    Guid Id,
    string OrderCode,
    Guid? CustomerId,
    string? CustomerSnapshotName,
    string OrderChannel,
    string OrderKind,
    string OrderStatus,
    string InventorySyncStatus,
    decimal TotalAmount,
    decimal DiscountAmount,
    decimal FinalAmount,
    DateTime CreatedAt,
    string? Note = null,
    Guid? CodPaymentId = null,
    bool? IsCodVerified = null,
    DateTime? CodWarningDate = null,
    decimal? CodExpectedAmount = null,
    int TotalQuantity = 0,
    // POS-04 (truy vết giữ chỗ): đơn đang giữ chỗ tồn Kệ Hàng — badge "Đang giữ hàng".
    bool HasActiveStockReservation = false,
    string? EmployeeSnapshotName = null,
    // POS-06 (KB4): dùng để hiện badge hạn giao ngoài danh sách đơn.
    DateTime? PickupDate = null
);

public record CustomBundleIngredientResponse(
    Guid Id,
    Guid MaterialSkuId,
    string MaterialSkuCode,
    string MaterialSnapshotName,
    int Quantity,
    decimal UnitPrice,
    decimal SubTotal);

public record CustomBundleResponse(
    Guid Id,
    Guid OrderId,
    string? Label,
    string? Note,
    decimal TotalPrice,
    string PackingStatus,
    DateTime? PackedAt,
    List<CustomBundleIngredientResponse> Ingredients);

public record ReceiptReprintLogResponse(
    Guid Id,
    Guid OrderId,
    Guid? PrintedByUserId,
    string? PrintedByName,
    string Reason,
    int ReprintNumber,
    DateTime PrintedAt);

public record ReceiptReprintItemResponse(
    string? Sku,
    string Name,
    int Qty,
    decimal Price,
    decimal Total);

public record ReceiptReprintDataResponse(
    Guid OrderId,
    string OrderCode,
    string? InvoiceCode,
    string CustomerName,
    string PaymentMethodLabel,
    DateTime CreatedAt,
    string? SellerName,
    List<ReceiptReprintItemResponse> Items,
    decimal GrossSubtotal,
    decimal TotalDiscount,
    decimal Total,
    decimal AmountPaid,
    decimal DebtAmount,
    bool IsReprint,
    int ReprintNumber,
    DateTime ReprintedAt,
    bool IsBackorder = false,
    string? FulfillmentPreference = null,
    DateTime? EstimatedReadyFrom = null,
    DateTime? EstimatedReadyTo = null,
    DateTime? PickupDate = null,
    string? PickupContactName = null,
    string? PickupContactPhone = null,
    string? PickupCode = null);

public record ReceiptReprintResponse(
    ReceiptReprintLogResponse Log,
    ReceiptReprintDataResponse Receipt);
