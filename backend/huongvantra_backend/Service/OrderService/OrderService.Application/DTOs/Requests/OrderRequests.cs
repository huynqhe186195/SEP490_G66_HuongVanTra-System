using OrderService.Domain.Enums;

namespace OrderService.Application.DTOs.Requests;

public record CreateOrderRequest(
    Guid? CustomerId,
    string? CustomerSnapshotName,
    Guid? EmployeeId,
    OrderChannel OrderChannel,
    string? ShippingAddress,
    string? Note,
    decimal DiscountAmount,
    List<CreateOrderDetailRequest> Items,
    PaymentMethod PaymentMethod,
    decimal PaidAmount,
    decimal TransferQrAmount = 0,
    Guid? PromotionId = null,
    string? PromotionCode = null,
    string? CodDebtSettlementJson = null,
    OrderKind OrderKind = OrderKind.Sale,
    List<CreateCustomBundleRequest>? CustomBundles = null,
    List<CreatePaymentAllocationRequest>? Payments = null,
    Guid? ContractId = null,
    bool AcceptBackorder = false,
    FulfillmentPreference FulfillmentPreference = FulfillmentPreference.PartialDelivery,
    // POS-06 (KB4): thu ngân nhập ngày hẹn khách quay lại lấy hàng khi chấp nhận backorder.
    DateTime? PickupDate = null,
    string? PickupNote = null,
    string? PickupContactName = null,
    string? PickupContactPhone = null
);

public record CreatePaymentAllocationRequest(
    PaymentMethod PaymentMethod,
    decimal Amount,
    string? DebtSettlementJson = null
);

public record CreateOrderDetailRequest(
    Guid SkuId,
    string SkuSnapshotName,
    string? SkuSnapshotCode,
    string? CategorySnapshotName,
    decimal Quantity,
    decimal CostPrice,
    decimal UnitPrice = 0,
    bool IsGift = false,
    int? CategoryId = null
);

public record UpdateOrderDetailRequest(
    Guid? Id,
    Guid SkuId,
    string SkuSnapshotName,
    string? SkuSnapshotCode,
    string? CategorySnapshotName,
    decimal Quantity,
    decimal CostPrice,
    decimal UnitPrice,
    bool IsGift = false,
    int? CategoryId = null
);

public record UpdateOrderRequest(
    string? ShippingAddress,
    string? Note,
    decimal DiscountAmount,
    Guid? PromotionId = null,
    string? PromotionCode = null,
    List<UpdateOrderDetailRequest>? Items = null
);

public record CancelOrderRequest(string? Reason);

public record ReviewBackorderCancellationRequest(bool Approved, string? Note = null);

public record CompleteBackorderRefundRequest(
    string RefundMethod,
    string RefundEvidence,
    bool ImmediateItemsReturned = false);

public record VerifyCodPaymentRequest(
    string? TransactionRef,
    decimal CollectedAmount = 0,
    string? DebtSettlementJson = null);

public record ReturnOrderLineRequest(Guid OrderDetailId, int ReturnQuantity);

public record ReturnExchangeItemRequest(
    Guid SkuId,
    string SkuSnapshotName,
    string? SkuSnapshotCode,
    string? CategorySnapshotName,
    int Quantity,
    decimal CostPrice,
    decimal UnitPrice);

public record ReturnOrderRequest(
    List<ReturnOrderLineRequest> Items,
    string PaymentMethod,
    decimal CustomerPaidAmount,
    List<ReturnExchangeItemRequest>? ExchangeItems = null,
    string? Note = null,
    string? ExchangeFulfillment = null,
    decimal ExchangeManualDiscount = 0,
    List<string>? Reasons = null,
    string? OtherReason = null);

public record CreateCustomBundleRequest(
    string? Label,
    string? Note,
    List<CreateCustomBundleIngredientRequest> Ingredients);

public record CreateCustomBundleIngredientRequest(
    Guid MaterialSkuId,
    string MaterialSkuCode,
    string MaterialSnapshotName,
    int Quantity,
    decimal UnitPrice);

public record ReprintReceiptRequest(string Reason);

public record GetOrdersRequest(
    string? Search,
    string? CustomerId,
    string? Status,
    string? Channel,
    string? ExcludeChannel = null,
    string? CodTab = null,
    bool ReturnableOnly = false,
    string? OrderKind = null,
    string? ExcludeOrderKind = null,
    string? FromDate = null,
    string? ToDate = null,
    string? EmployeeId = null,
    string? Page = null,
    string? PageSize = null,
    // POS-04 (truy vết giữ chỗ): true = chỉ lấy đơn đang giữ chỗ tồn Kệ Hàng.
    bool HasActiveReservation = false
);
