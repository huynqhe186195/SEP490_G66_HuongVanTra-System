namespace CustomerService.Application.DTOs.Requests;

public record SimulateOrderCompletedRequest(
    Guid? OrderId,
    string? OrderCode,
    Guid CustomerId,
    decimal TotalAmount,
    decimal DebtAmount
);
