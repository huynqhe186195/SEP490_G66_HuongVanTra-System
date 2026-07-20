namespace ProductService.Domain.Entities;

public class ProductDeletionRequestItem : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RequestId { get; set; }
    public ProductDeletionRequest? Request { get; set; }
    public Guid ProductId { get; set; }
    public string ProductSnapshotJson { get; set; } = "{}";
    public string ProductName { get; set; } = string.Empty;
    public string? ProductType { get; set; }
    public string? CategoryName { get; set; }
    public int VariantCount { get; set; }
    public string? Reason { get; set; }
    public string ValidationStatus { get; set; } = "not_validated";
    public string? ValidationMessage { get; set; }
}
