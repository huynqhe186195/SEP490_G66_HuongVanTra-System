using HuongVanTra.Shared.Messages;
using InventoryService.Application.UseCases;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace InventoryService.Infrastructure.Messaging;

public class SkuCreatedConsumer(InventoryLogic _logic, ILogger<SkuCreatedConsumer> _logger)
    : IConsumer<SkuCreatedEvent>
{
    public async Task Consume(ConsumeContext<SkuCreatedEvent> context)
    {
        var msg = context.Message;
        _logger.LogInformation("Received SkuCreatedEvent {SkuCode} ({SkuId})", msg.SkuCode, msg.SkuId);
        await _logic.HandleSkuCreatedAsync(msg, context.CancellationToken);
    }
}
