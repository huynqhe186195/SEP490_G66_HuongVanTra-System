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
    string OrderStatus,
    string InventorySyncStatus,
    decimal TotalAmount,
    decimal DiscountAmount,
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
    decimal UnitPrice,
    decimal SubTotal
);

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
    DateTime? PaidAt
);

public record OrderSummaryResponse(
    Guid Id,
    string OrderCode,
    Guid? CustomerId,
    string? CustomerSnapshotName,
    string OrderChannel,
    string OrderStatus,
    string InventorySyncStatus,
    decimal FinalAmount,
    DateTime CreatedAt
);
