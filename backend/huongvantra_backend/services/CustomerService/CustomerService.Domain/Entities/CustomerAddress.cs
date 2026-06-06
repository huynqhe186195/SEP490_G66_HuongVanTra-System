namespace CustomerService.Domain.Entities;

public class CustomerAddress : BaseEntity
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public string ReceiverName { get; set; } = string.Empty;
    public string ReceiverPhone { get; set; } = string.Empty;
    public string AddressLine { get; set; } = string.Empty;
    public string Ward { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public string Province { get; set; } = string.Empty;
    public bool IsDefault { get; set; }

    public Customer Customer { get; set; } = null!;
}
