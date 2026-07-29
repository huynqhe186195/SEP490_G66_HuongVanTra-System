namespace InventoryService.Application.Interfaces;

public interface IInventoryEventPublisher
{
    Task PublishStockDeductedAsync(Guid orderId, string orderCode, bool success, CancellationToken ct = default);
    Task PublishStockDeductionCancelledAsync(Guid orderId, string orderCode, string reason, CancellationToken ct = default);
    Task PublishLowStockAsync(Guid skuId, string skuCode, int currentStock, int threshold, CancellationToken ct = default);
    Task EnqueueSupplierReceiptCostRecordedAsync(
        HuongVanTra.Shared.Messages.SupplierReceiptApprovedCostRecordedEvent message,
        CancellationToken ct = default);
}
