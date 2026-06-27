using HuongVanTra.Shared.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace InventoryService.Infrastructure.Messaging;

public class LowStockConsumer(ILogger<LowStockConsumer> _logger) : IConsumer<LowStockEvent>
{
    public Task Consume(ConsumeContext<LowStockEvent> context)
    {
        var msg = context.Message;
        _logger.LogWarning(
            "⚠️ Tồn kho thấp — SKU: {SkuCode} ({SkuId}) | Tồn hiện tại: {CurrentStock} | Ngưỡng: {Threshold} | Lúc: {OccurredAt:yyyy-MM-dd HH:mm:ss} UTC",
            msg.SkuCode, msg.SkuId, msg.CurrentStock, msg.Threshold, msg.OccurredAt);

        return Task.CompletedTask;
    }
}
