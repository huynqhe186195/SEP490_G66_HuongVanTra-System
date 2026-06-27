using MassTransit;
using HuongVanTra.Shared.Messages;
using OrderService.Application.Interfaces;

namespace OrderService.Infrastructure.Messaging;

public class OrderEventPublisher(IPublishEndpoint _publishEndpoint) : IOrderEventPublisher
{
    public Task PublishOrderPlacedAsync(
        Guid orderId, string orderCode, string orderStatus, decimal totalAmount,
        IEnumerable<(Guid SkuId, string SkuName, string? SkuCode, int Quantity)> items,
        CancellationToken ct = default) =>
        _publishEndpoint.Publish(new OrderPlacedEvent
        {
            OrderId = orderId,
            OrderCode = orderCode,
            OrderStatus = orderStatus,
            TotalAmount = totalAmount,
            Items = items.Select(i => new OrderItemEvent
            {
                SkuId = i.SkuId,
                SkuName = i.SkuName,
                SkuCode = i.SkuCode,
                Quantity = i.Quantity
            })
        }, ct);

    public Task PublishOrderCancelledAsync(
        Guid orderId, string orderCode,
        IEnumerable<(Guid SkuId, int Quantity)> items,
        CancellationToken ct = default) =>
        _publishEndpoint.Publish(new OrderCancelledEvent
        {
            OrderId = orderId,
            OrderCode = orderCode,
            Items = items.Select(i => new OrderItemEvent { SkuId = i.SkuId, Quantity = i.Quantity })
        }, ct);

    public Task PublishOrderCompletedAsync(
        Guid orderId, string orderCode, Guid customerId,
        decimal totalAmount, decimal debtAmount,
        IEnumerable<(Guid SkuId, int Quantity)> items,
        string? codDebtSettlementJson = null,
        CancellationToken ct = default) =>
        _publishEndpoint.Publish(new OrderCompletedEvent
        {
            OrderId = orderId,
            OrderCode = orderCode,
            CustomerId = customerId,
            TotalAmount = totalAmount,
            DebtAmount = debtAmount,
            Items = items.Select(i => new OrderItemEvent { SkuId = i.SkuId, Quantity = i.Quantity }),
            CodDebtSettlementJson = codDebtSettlementJson
        }, ct);

    public Task PublishOrderReturnedAsync(
        Guid returnId,
        string returnCode,
        Guid orderId,
        string orderCode,
        Guid? customerId,
        decimal returnAmount,
        decimal orderFinalAmount,
        decimal refundAmount,
        IEnumerable<(Guid SkuId, int Quantity)> items,
        CancellationToken ct = default) =>
        _publishEndpoint.Publish(new OrderReturnedEvent
        {
            ReturnId = returnId,
            ReturnCode = returnCode,
            OrderId = orderId,
            OrderCode = orderCode,
            CustomerId = customerId,
            ReturnAmount = returnAmount,
            OrderFinalAmount = orderFinalAmount,
            RefundAmount = refundAmount,
            Items = items.Select(i => new OrderItemEvent { SkuId = i.SkuId, Quantity = i.Quantity })
        }, ct);
}
