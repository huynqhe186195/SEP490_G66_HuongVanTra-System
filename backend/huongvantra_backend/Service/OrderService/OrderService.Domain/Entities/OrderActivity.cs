using OrderService.Domain.Enums;

namespace OrderService.Domain.Entities;

public class OrderActivity
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public OrderActivityType ActivityType { get; set; }
    public string Description { get; set; } = string.Empty;
    public Guid? ActorId { get; set; }
    public string? ActorName { get; set; }
    public DateTime CreatedAt { get; set; }

    public Order Order { get; set; } = null!;
}
