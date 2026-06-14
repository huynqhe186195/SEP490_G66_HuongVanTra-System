namespace ProductService.Domain.Entities;

public class ProductVariantBomLine : BaseEntity
{
    public int Id { get; set; }
    public Guid ProductVariantId { get; set; }
    public Guid MaterialId { get; set; }
    public decimal Quantity { get; set; }

    public ProductVariant Variant { get; set; } = null!;
    public Product Material { get; set; } = null!;
}
