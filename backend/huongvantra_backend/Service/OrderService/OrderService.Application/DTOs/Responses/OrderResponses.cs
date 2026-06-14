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
    List<PaymentResponse> Payments
);

public record OrderDetailResponse(
    Guid Id,
    Guid SkuId,
    string SkuSnapshotName,
    string? SkuSnapshotCode,
    int Quantity,
    int ReturnedQuantity,
    decimal UnitPrice,
    decimal SubTotal,
    bool IsGift
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
    string? ExchangeOrderCode
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
    List<ReturnOrderLineResponse> Items);

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
    DateTime CreatedAt);

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
    string? CodDebtSettlementJson = null
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
    int TotalQuantity = 0
);
