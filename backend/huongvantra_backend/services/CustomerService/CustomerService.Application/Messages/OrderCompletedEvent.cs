namespace CustomerService.Application.Messages;

public record OrderCompletedEvent
{
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public Guid CustomerId { get; init; }
    public decimal TotalAmount { get; init; }
    public decimal DebtAmount { get; init; }
}
