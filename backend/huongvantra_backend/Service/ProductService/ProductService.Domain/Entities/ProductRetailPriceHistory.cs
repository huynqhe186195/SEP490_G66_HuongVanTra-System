namespace ProductService.Domain.Entities;

/// <summary>
/// Durable audit trail for manual Accounting RetailPrice changes.
/// </summary>
public sealed class ProductRetailPriceHistory
{
    public Guid Id { get; set; }
    public Guid SkuId { get; set; }
    public decimal OldRetailPrice { get; set; }
    public decimal NewRetailPrice { get; set; }
    public Guid? ChangedBy { get; set; }
    public string? ChangedByName { get; set; }
    public DateTime ChangedAt { get; set; }
    public string SourceType { get; set; } = "manual_admin_accounting";
    public string? Note { get; set; }
}
