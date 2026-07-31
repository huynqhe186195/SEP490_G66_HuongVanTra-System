namespace InventoryService.Domain.Entities;

public class StockTransferBatchAllocation
{
    public Guid Id { get; set; }
    public Guid StockTransferId { get; set; }
    public Guid StockTransferLineId { get; set; }
    public Guid SourceWarehouseBatchId { get; set; }
    public Guid SourceWarehouseBatchItemId { get; set; }
    public Guid DestinationWarehouseBatchId { get; set; }
    public Guid DestinationWarehouseBatchItemId { get; set; }
    public int Quantity { get; set; }

    public StockTransfer? StockTransfer { get; set; }
    public StockTransferLine? StockTransferLine { get; set; }
    public WarehouseBatch? SourceWarehouseBatch { get; set; }
    public WarehouseBatchItem? SourceWarehouseBatchItem { get; set; }
    public WarehouseBatch? DestinationWarehouseBatch { get; set; }
    public WarehouseBatchItem? DestinationWarehouseBatchItem { get; set; }
}
