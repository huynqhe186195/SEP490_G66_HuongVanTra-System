namespace ProductService.Domain.Entities;

public class ProductSku : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProductId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string PackagingType { get; set; } = string.Empty;
    public int WeightInGrams { get; set; }
    public decimal BasePrice { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
    /// <summary>Thời điểm đồng bộ sang catalog cửa hàng; null = chưa bán tại quầy.</summary>
    public DateTime? SyncedToStoreAt { get; set; }

    public Product Product { get; set; } = null!;
}
