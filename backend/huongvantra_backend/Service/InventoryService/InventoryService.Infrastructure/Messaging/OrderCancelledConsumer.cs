using HuongVanTra.Shared.Messages;
using InventoryService.Application.UseCases;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace InventoryService.Infrastructure.Messaging;

public class OrderCancelledConsumer(InventoryLogic _logic, ILogger<OrderCancelledConsumer> _logger)
    : IConsumer<OrderCancelledEvent>
{
    public async Task Consume(ConsumeContext<OrderCancelledEvent> context)
    {
        var msg = context.Message;
        _logger.LogInformation("Received OrderCancelledEvent {OrderCode} ({OrderId})", msg.OrderCode, msg.OrderId);
        await _logic.HandleOrderCancelledAsync(msg, context.CancellationToken);
    }
}
