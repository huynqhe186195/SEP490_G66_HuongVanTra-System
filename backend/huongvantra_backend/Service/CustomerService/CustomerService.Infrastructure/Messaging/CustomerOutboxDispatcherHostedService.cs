using System.Text.Json;
using CustomerService.Infrastructure.Data;
using HuongVanTra.Shared.Messages;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CustomerService.Infrastructure.Messaging;

public sealed class CustomerOutboxDispatcherHostedService(IServiceScopeFactory scopeFactory, ILogger<CustomerOutboxDispatcherHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await DispatchOneAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "Customer Outbox dispatch failed"); }
            await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
        }
    }

    private async Task DispatchOneAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CustomerDbContext>();
        var publisher = scope.ServiceProvider.GetRequiredService<IPublishEndpoint>();
        var now = DateTime.UtcNow;
        var row = await db.CustomerOutboxMessages.OrderBy(x => x.OccurredAtUtc)
            .FirstOrDefaultAsync(x => x.Status == "Pending" && x.NextAttemptAtUtc <= now, ct);
        if (row is null) return;
        try
        {
            var message = JsonSerializer.Deserialize<CustomerTierUpgradedEvent>(row.Payload)
                ?? throw new InvalidOperationException("Customer outbox payload is invalid.");
            await publisher.Publish(message, ct);
            row.Status = "Published"; row.PublishedAtUtc = DateTime.UtcNow; row.LastError = null;
        }
        catch (Exception ex)
        {
            row.RetryCount++; row.LastError = ex.Message;
            row.NextAttemptAtUtc = DateTime.UtcNow.AddMinutes(Math.Min(30, Math.Max(1, row.RetryCount)));
            logger.LogWarning(ex, "Customer Outbox {OutboxId} will retry", row.Id);
        }
        await db.SaveChangesAsync(ct);
    }
}
