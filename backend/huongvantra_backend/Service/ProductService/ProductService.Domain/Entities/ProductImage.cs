namespace ProductService.Domain.Entities;

public class ProductImage : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProductId { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public string? AltText { get; set; }
    public int SortOrder { get; set; }
    public bool IsThumbnail { get; set; }

    public Product Product { get; set; } = null!;
}
