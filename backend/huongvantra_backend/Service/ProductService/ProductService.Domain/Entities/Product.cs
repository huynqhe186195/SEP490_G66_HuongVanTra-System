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
    public string BaseUnit { get; set; } = "unit";
    public decimal? WeightValue { get; set; }
    public string? WeightUnit { get; set; }
    public bool IsVariantParent { get; set; }
    public bool IsActive { get; set; } = true;
    /// <summary>Thời điểm đồng bộ sang catalog cửa hàng; null = chỉ có ở kho.</summary>
    public DateTime? SyncedToStoreAt { get; set; }

    public Category Category { get; set; } = null!;
    public ICollection<ProductSku> Skus { get; set; } = new List<ProductSku>();
    public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();
    public ICollection<ProductUnit> Units { get; set; } = new List<ProductUnit>();
    public ICollection<ProductVariant> Variants { get; set; } = new List<ProductVariant>();
}
