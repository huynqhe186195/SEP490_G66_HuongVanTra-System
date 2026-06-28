namespace ProductService.Domain.Entities;

public class PriceBookEntry : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PriceBookId { get; set; }
    public Guid? VariantId { get; set; }
    public Guid? UnitId { get; set; }
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }

    public PriceBook PriceBook { get; set; } = null!;
    public ProductVariant? Variant { get; set; }
    public ProductUnit? Unit { get; set; }
}
