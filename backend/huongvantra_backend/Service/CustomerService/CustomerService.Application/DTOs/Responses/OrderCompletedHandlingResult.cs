namespace CustomerService.Application.DTOs.Responses;

public record OrderCompletedHandlingResult(
    Guid OrderId,
    Guid CustomerId,
    bool SkippedDuplicate,
    bool CustomerNotFound,
    decimal TotalSpending,
    decimal CurrentDebt,
    int? TierId,
    string? TierName,
    bool TierUpgraded,
    string? CustomerName = null,
    string? CustomerEmail = null,
    string? PreviousTierName = null
);
