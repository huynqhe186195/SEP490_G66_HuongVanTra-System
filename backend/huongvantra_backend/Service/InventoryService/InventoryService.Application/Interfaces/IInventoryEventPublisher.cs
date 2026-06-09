namespace InventoryService.Application.Interfaces;

public interface IInventoryEventPublisher
{
    Task PublishStockDeductedAsync(Guid orderId, string orderCode, bool success, CancellationToken ct = default);
}
