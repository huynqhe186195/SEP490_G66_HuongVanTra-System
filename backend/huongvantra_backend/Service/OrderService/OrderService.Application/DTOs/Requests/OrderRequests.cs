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
    Guid? PromotionId = null,
    string? PromotionCode = null
);

public record CreateOrderDetailRequest(
    Guid SkuId,
    string SkuSnapshotName,
    string? SkuSnapshotCode,
    int Quantity,
    decimal UnitPrice
);

public record UpdateOrderRequest(
    string? ShippingAddress,
    string? Note,
    decimal DiscountAmount
);

public record CancelOrderRequest(string? Reason);

public record VerifyCodPaymentRequest(string? TransactionRef);

public record GetOrdersRequest(
    string? Search,
    Guid? CustomerId,
    string? Status,
    string? Channel,
    int Page = 1,
    int PageSize = 20
);
