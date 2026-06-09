using HuongVanTra.Shared.Messages;
using InventoryService.Application.UseCases;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace InventoryService.Infrastructure.Messaging;

public class OrderPlacedConsumer(InventoryLogic _logic, ILogger<OrderPlacedConsumer> _logger)
    : IConsumer<OrderPlacedEvent>
{
    public async Task Consume(ConsumeContext<OrderPlacedEvent> context)
    {
        var msg = context.Message;
        _logger.LogInformation("Received OrderPlacedEvent {OrderCode} ({OrderId})", msg.OrderCode, msg.OrderId);
        await _logic.HandleOrderPlacedAsync(msg, context.CancellationToken);
    }
}
