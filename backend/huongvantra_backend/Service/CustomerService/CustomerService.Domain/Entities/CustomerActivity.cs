using CustomerService.Domain.Enums;

namespace CustomerService.Domain.Entities;

public class CustomerActivity
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public CustomerActivityType ActivityType { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public Customer Customer { get; set; } = null!;
}
