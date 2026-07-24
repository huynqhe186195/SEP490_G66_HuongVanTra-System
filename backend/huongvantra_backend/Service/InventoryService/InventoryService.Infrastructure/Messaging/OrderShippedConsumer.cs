using HuongVanTra.Shared.Messages;
using InventoryService.Application.UseCases;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace InventoryService.Infrastructure.Messaging;

/// <summary>
/// POS-04 (H5): nhận OrderShippedEvent — trigger duy nhất trừ tồn vật lý Kệ Hàng
/// cho đơn COD đã giữ chỗ. Handler idempotent theo EventId + business key.
/// </summary>
public class OrderShippedConsumer(InventoryLogic _logic, ILogger<OrderShippedConsumer> _logger)
    : IConsumer<OrderShippedEvent>
{
    public async Task Consume(ConsumeContext<OrderShippedEvent> context)
    {
        var msg = context.Message;
        _logger.LogInformation("Received OrderShippedEvent {OrderCode} ({OrderId})", msg.OrderCode, msg.OrderId);
        await _logic.HandleOrderShippedAsync(msg, context.CancellationToken);
    }
}
