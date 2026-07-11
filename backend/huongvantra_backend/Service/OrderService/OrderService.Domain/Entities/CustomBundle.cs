using OrderService.Domain.Enums;

namespace OrderService.Domain.Entities;

public class CustomBundle : BaseEntity
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public string? Label { get; set; }
    public string? Note { get; set; }
    public decimal TotalPrice { get; set; }
    public PackingStatus PackingStatus { get; set; } = PackingStatus.Pending;
    public DateTime? PackedAt { get; set; }
    public ICollection<CustomBundleIngredient> Ingredients { get; set; } = new List<CustomBundleIngredient>();
    public Order Order { get; set; } = null!;
}
