namespace InventoryService.Domain.Entities;

public class SupplierReceiptItem
{
    public Guid Id { get; set; }
    public Guid SupplierReceiptId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string SkuNameSnapshot { get; set; } = string.Empty;
    public string ProductTypeSnapshot { get; set; } = string.Empty;
    public string InventoryUnitSnapshot { get; set; } = string.Empty;
    public string? SubmittedUnit { get; set; }
    public decimal SubmittedQuantity { get; set; }
    public int Quantity { get; set; }
    public decimal? UnitCost { get; set; }
    public string LotCode { get; set; } = string.Empty;
    public DateTime? ManufacturedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int ActualReceivedQuantity { get; set; }
    public string? QualityNote { get; set; }
    public Guid? WarehouseBatchId { get; set; }
    public string? WarehouseBatchLotCode { get; set; }
    public int? WarehouseQtyBefore { get; set; }
    public int? WarehouseQtyAfter { get; set; }
    public int? ShelfQtyBefore { get; set; }
    public int? ShelfQtyAfter { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public SupplierReceipt? SupplierReceipt { get; set; }
    public WarehouseBatch? WarehouseBatch { get; set; }
}
