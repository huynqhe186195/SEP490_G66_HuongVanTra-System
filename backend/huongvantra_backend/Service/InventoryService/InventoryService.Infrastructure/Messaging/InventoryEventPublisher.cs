using HuongVanTra.Shared.Messages;
using InventoryService.Application.Interfaces;
using MassTransit;

namespace InventoryService.Infrastructure.Messaging;

public class InventoryEventPublisher(IPublishEndpoint _publishEndpoint) : IInventoryEventPublisher
{
    public Task PublishStockDeductedAsync(
        Guid orderId, string orderCode, bool success, CancellationToken ct = default) =>
        _publishEndpoint.Publish(new StockDeductedEvent
        {
            OrderId = orderId,
            OrderCode = orderCode,
            Success = success
        }, ct);
}
