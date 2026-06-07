using MassTransit;
using HuongVanTra.Shared.Messages;
using OrderService.Application.Interfaces;

namespace OrderService.Infrastructure.Messaging;

public class OrderEventPublisher(IPublishEndpoint _publishEndpoint) : IOrderEventPublisher
{
    public async Task PublishOrderCompletedAsync(
        Guid orderId, string orderCode, Guid customerId,
        decimal totalAmount, decimal debtAmount,
        IEnumerable<(Guid SkuId, int Quantity)> items,
        CancellationToken ct = default)
    {
        await _publishEndpoint.Publish(new OrderCompletedEvent
        {
            OrderId = orderId,
            OrderCode = orderCode,
            CustomerId = customerId,
            TotalAmount = totalAmount,
            DebtAmount = debtAmount,
            Items = items.Select(i => new OrderItemEvent { SkuId = i.SkuId, Quantity = i.Quantity })
        }, ct);
    }
}
