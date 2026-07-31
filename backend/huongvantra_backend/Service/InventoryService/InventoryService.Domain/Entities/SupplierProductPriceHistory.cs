namespace InventoryService.Domain.Entities;

/// <summary>
/// Lịch sử thay đổi giá chào của nhà cung cấp cho một SKU.
/// </summary>
public class SupplierProductPriceHistory
{
    public Guid Id { get; set; }
    public Guid SupplierProductId { get; set; }
    public Guid SupplierId { get; set; }
    public Guid SkuId { get; set; }
    public decimal? OldPrice { get; set; }
    public decimal? NewPrice { get; set; }
    public DateTime EffectiveDate { get; set; }
    public Guid? ChangedBy { get; set; }
    public string? ChangedByName { get; set; }
    public DateTime ChangedAt { get; set; }
    public string? Reason { get; set; }
}
