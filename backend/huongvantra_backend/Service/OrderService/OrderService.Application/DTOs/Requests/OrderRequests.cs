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
    OrderKind OrderKind = OrderKind.Sale
);

public record CreateOrderDetailRequest(
    Guid SkuId,
    string SkuSnapshotName,
    string? SkuSnapshotCode,
    string? CategorySnapshotName,
    int Quantity,
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
    int Quantity,
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

public record VerifyCodPaymentRequest(
    string? TransactionRef,
    decimal CollectedAmount = 0);

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
    string? ExchangeFulfillment = null);

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
    string? PageSize = null
);
