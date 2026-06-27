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

    public Task PublishCostPriceUpdatedAsync(Guid skuId, decimal newCostPrice, CancellationToken ct = default) =>
        _publishEndpoint.Publish(new CostPriceUpdatedEvent
        {
            SkuId = skuId,
            NewCostPrice = newCostPrice
        }, ct);

    public Task PublishLowStockAsync(
        Guid skuId, string skuCode, int currentStock, int threshold, CancellationToken ct = default) =>
        _publishEndpoint.Publish(new LowStockEvent
        {
            SkuId = skuId,
            SkuCode = skuCode,
            CurrentStock = currentStock,
            Threshold = threshold,
            OccurredAt = DateTime.UtcNow
        }, ct);
}
