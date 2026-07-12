using HuongVanTra.Shared.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;
using OrderService.Application.UseCases;

namespace OrderService.Infrastructure.Messaging;

public class StockDeductedConsumer(OrderLogic _orderLogic, ILogger<StockDeductedConsumer> _logger)
    : IConsumer<StockDeductedEvent>
{
    public async Task Consume(ConsumeContext<StockDeductedEvent> context)
    {
        var msg = context.Message;
        if (!msg.Success)
        {
            if (string.Equals(msg.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Marking order {OrderId} inventory deduction cancelled", msg.OrderId);
                await _orderLogic.MarkInventoryDeductionCancelledAsync(
                    msg.OrderId,
                    msg.Reason,
                    context.CancellationToken);
                return;
            }

            _logger.LogWarning("StockDeductedEvent failed for order {OrderCode}", msg.OrderCode);
            return;
        }

        _logger.LogInformation("Marking order {OrderId} inventory synced", msg.OrderId);
        await _orderLogic.MarkInventorySyncedAsync(msg.OrderId, context.CancellationToken);
    }
}
