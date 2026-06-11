namespace ProductService.Domain.Entities;

public class ProductUnit : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProductId { get; set; }
    public Guid? VariantId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public decimal ConversionRate { get; set; } = 1;
    public decimal? Price { get; set; }
    public string? Barcode { get; set; }
    public bool IsDirectSell { get; set; } = true;
    public bool IsBaseUnit { get; set; }

    public Product Product { get; set; } = null!;
    public ProductVariant? Variant { get; set; }
    public ICollection<PriceBookEntry> PriceBookEntries { get; set; } = new List<PriceBookEntry>();
}
