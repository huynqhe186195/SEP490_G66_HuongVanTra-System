namespace InventoryService.Application.DTOs.Responses;

public class InventoryStatisticsResponse
{
    public int TotalSkus { get; set; }
    public int TotalStoreQuantity { get; set; }
    public int TotalWarehouseQuantity { get; set; }
    public int LowStockSkuCount { get; set; }
    public decimal TotalWarehouseValue { get; set; }
    public int PendingDeductQueueCount { get; set; }
}
