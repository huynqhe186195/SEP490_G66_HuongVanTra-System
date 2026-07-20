using AuditService.Infrastructure.UseCases;
using HuongVanTra.Shared.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace AuditService.Infrastructure.Messaging;

public class SystemActivityConsumer(
    SystemActivityWriter writer,
    ILogger<SystemActivityConsumer> logger)
    : IConsumer<SystemActivityEvent>
{
    public async Task Consume(ConsumeContext<SystemActivityEvent> context)
    {
        var created = await writer.WriteAsync(context.Message, context.CancellationToken);
        if (!created)
        {
            logger.LogDebug("Duplicate SystemActivityEvent {EventId} ignored.", context.Message.EventId);
            return;
        }
    }
}
