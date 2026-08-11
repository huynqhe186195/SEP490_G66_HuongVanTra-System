using HuongVanTra.Shared.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Messaging;

public sealed class CustomerTierUpgradedConsumer(IEmailService emailService, OrderDbContext db, ILogger<CustomerTierUpgradedConsumer> logger)
    : IConsumer<CustomerTierUpgradedEvent>
{
    public async Task Consume(ConsumeContext<CustomerTierUpgradedEvent> context)
    {
        var message = context.Message;
        if (string.IsNullOrWhiteSpace(message.CustomerEmail) || string.IsNullOrWhiteSpace(message.NewTierName)) return;
        var delivery = await db.TierUpgradeEmailDeliveries.FindAsync([message.EventId], context.CancellationToken);
        if (delivery?.SentAtUtc is not null) return;
        delivery ??= new TierUpgradeEmailDelivery { EventId = message.EventId, CustomerId = message.CustomerId, TierName = message.NewTierName, ReceivedAtUtc = DateTime.UtcNow };
        if (db.Entry(delivery).State == Microsoft.EntityFrameworkCore.EntityState.Detached) db.TierUpgradeEmailDeliveries.Add(delivery);
        delivery.AttemptCount++;
        try
        {
            await emailService.SendTierUpgradeEmailAsync(message.CustomerEmail, message.CustomerName, message.PreviousTierName, message.NewTierName, message.TotalSpending, context.CancellationToken);
            delivery.SentAtUtc = DateTime.UtcNow; delivery.LastError = null;
            await db.SaveChangesAsync(context.CancellationToken);
        }
        catch (Exception ex)
        {
            delivery.LastError = ex.Message; await db.SaveChangesAsync(context.CancellationToken); throw;
        }
    }
}
