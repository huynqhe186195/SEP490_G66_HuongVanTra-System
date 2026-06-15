namespace CustomerService.Application.DTOs.Responses;

public record OrderReturnedHandlingResult(
    Guid ReturnId,
    Guid OrderId,
    Guid? CustomerId,
    bool SkippedDuplicate,
    bool CustomerNotFound,
    bool SkippedNoCustomer,
    decimal SpendingReduced,
    decimal DebtReduced,
    decimal TotalSpending,
    decimal CurrentDebt
);
