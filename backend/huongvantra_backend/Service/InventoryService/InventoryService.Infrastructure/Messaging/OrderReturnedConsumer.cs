using HuongVanTra.Shared.Messages;
using InventoryService.Application.UseCases;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace InventoryService.Infrastructure.Messaging;

public class OrderReturnedConsumer(InventoryLogic _logic, ILogger<OrderReturnedConsumer> _logger)
    : IConsumer<OrderReturnedEvent>
{
    public async Task Consume(ConsumeContext<OrderReturnedEvent> context)
    {
        var msg = context.Message;
        _logger.LogInformation(
            "Received OrderReturnedEvent {OrderCode} ({OrderId}) return {ReturnId}",
            msg.OrderCode,
            msg.OrderId,
            msg.ReturnId);
        await _logic.HandleOrderReturnedAsync(msg, context.CancellationToken);
    }
}
