namespace ProductService.Domain.Entities;

public class ProductCreationRequestItem : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RequestId { get; set; }
    public ProductCreationRequest? Request { get; set; }

    public string ClientKey { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string ProductSnapshotJson { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string? ProductType { get; set; }
    public int? CategoryId { get; set; }
    public string? BaseUnit { get; set; }
    public string? InventoryUnit { get; set; }
    public int VariantCount { get; set; }
    public int BomLineCount { get; set; }
    public string ValidationStatus { get; set; } = "not_validated";
    public string? ValidationMessage { get; set; }
}
