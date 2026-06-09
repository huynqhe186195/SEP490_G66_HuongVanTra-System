namespace InventoryService.Domain.Entities;

public class SkuStock
{
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public int WeightInGrams { get; set; }
    public int QuantityOnHand { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
