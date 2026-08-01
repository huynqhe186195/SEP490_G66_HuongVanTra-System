namespace InventoryService.Domain.Entities;

public class StockTransferLine
{
    public Guid Id { get; set; }
    public Guid StockTransferId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string SkuNameSnapshot { get; set; } = string.Empty;
    public string? UnitNameSnapshot { get; set; }
    public int Quantity { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>Dòng yêu cầu bổ sung Kệ Hàng nguồn của dòng điều chuyển này.</summary>
    public Guid? SourceRequestLineId { get; set; }
    public StockAdjustmentRequestItem? SourceRequestLine { get; set; }

    public StockTransfer? StockTransfer { get; set; }
    public ICollection<StockTransferBatchAllocation> BatchAllocations { get; set; } = new List<StockTransferBatchAllocation>();
}
