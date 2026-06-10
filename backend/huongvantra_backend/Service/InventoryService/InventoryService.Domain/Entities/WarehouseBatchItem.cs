namespace InventoryService.Domain.Entities;

/// <summary>Một dòng SKU trong lô nhập kho.</summary>
public class WarehouseBatchItem
{
    public Guid Id { get; set; }
    public Guid WarehouseBatchId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string? ProductSnapshotName { get; set; }
    public int QuantityOnHand { get; set; }
    public int InitialQuantity { get; set; }
    public decimal? UnitCost { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public WarehouseBatch? Batch { get; set; }
}
