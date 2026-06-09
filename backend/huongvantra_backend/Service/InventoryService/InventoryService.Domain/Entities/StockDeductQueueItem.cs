namespace InventoryService.Domain.Entities;

public class StockDeductQueueItem
{
    public Guid Id { get; set; }
    public Guid QueueId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuSnapshotName { get; set; } = string.Empty;
    public string? SkuSnapshotCode { get; set; }
    public int Quantity { get; set; }
    public StockDeductQueue Queue { get; set; } = null!;
}
