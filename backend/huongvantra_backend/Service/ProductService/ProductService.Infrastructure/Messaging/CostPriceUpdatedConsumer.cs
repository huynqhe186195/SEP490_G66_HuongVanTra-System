using HuongVanTra.Shared.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace ProductService.Infrastructure.Messaging;

public class CostPriceUpdatedConsumer(ILogger<CostPriceUpdatedConsumer> _logger) : IConsumer<CostPriceUpdatedEvent>
{
    public Task Consume(ConsumeContext<CostPriceUpdatedEvent> context)
    {
        var msg = context.Message;
        _logger.LogWarning(
            "Ignoring legacy CostPriceUpdatedEvent for SkuId {SkuId}; Inventory is no longer the owner of ProductVariant.CostPrice.",
            msg.SkuId);
        return Task.CompletedTask;
    }
}
