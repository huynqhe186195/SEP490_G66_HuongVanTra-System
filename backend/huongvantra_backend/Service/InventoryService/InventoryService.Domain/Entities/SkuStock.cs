namespace InventoryService.Domain.Entities;

public class SkuStock
{
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public int WeightInGrams { get; set; }
    /// <summary>Số lượng tại Kệ Hàng.</summary>
    public int QuantityOnHand { get; set; }
    /// <summary>Số lượng tại Kho.</summary>
    public int WarehouseQuantityOnHand { get; set; }
    /// <summary>
    /// POS-04: số lượng tại Kệ Hàng đã được giữ chỗ cho các đơn COD chờ xác nhận (chưa trừ vật lý).
    /// Tồn khả bán = QuantityOnHand - ReservedQuantity. Luôn &gt;= 0.
    /// </summary>
    public int ReservedQuantity { get; set; }
    /// <summary>Legacy threshold kept for backward compatibility. Semantically maps to ShelfLowStockThreshold.</summary>
    public int LowStockThreshold { get; set; } = 0;
    /// <summary>Ngưỡng tồn thấp tại Kho.</summary>
    public int WarehouseLowStockThreshold { get; set; } = 0;
    /// <summary>Ngưỡng tồn thấp tại Kệ Hàng.</summary>
    public int ShelfLowStockThreshold { get; set; } = 0;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
