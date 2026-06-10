namespace InventoryService.Domain.Entities;

public class SkuStock
{
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public int WeightInGrams { get; set; }
    /// <summary>Số lượng tại cửa hàng (bán POS).</summary>
    public int QuantityOnHand { get; set; }
    /// <summary>Số lượng tại kho tổng.</summary>
    public int WarehouseQuantityOnHand { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
