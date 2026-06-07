namespace ProductService.Domain.Entities;

public class Product : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Origin { get; set; }
    public string? FlavorProfile { get; set; }
    public string? BrewingGuide { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;

    public Category Category { get; set; } = null!;
    public ICollection<ProductSku> Skus { get; set; } = new List<ProductSku>();
}
