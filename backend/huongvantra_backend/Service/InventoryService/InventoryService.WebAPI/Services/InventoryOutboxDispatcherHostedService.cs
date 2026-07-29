using System.Text.Json;
using HuongVanTra.Shared.Messages;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using MassTransit;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.WebAPI.Services;

/// <summary>
/// Publishes committed InventoryService Outbox rows. Broker I/O is deliberately
/// outside the Inventory business transaction.
/// </summary>
public sealed class InventoryOutboxDispatcherHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<InventoryOutboxDispatcherHostedService> logger) : BackgroundService
{
    private const int MaxRetryCount = 10;
    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan LeaseDuration = TimeSpan.FromMinutes(2);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly string SupportedEventType =
        typeof(SupplierReceiptApprovedCostRecordedEvent).FullName
        ?? nameof(SupplierReceiptApprovedCostRecordedEvent);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var processed = await ProcessOneAsync(stoppingToken);
                if (!processed)
                    await Task.Delay(IdleDelay, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Inventory Outbox dispatcher loop failed.");
                await Task.Delay(IdleDelay, stoppingToken);
            }
        }
    }

    private async Task<bool> ProcessOneAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<InventoryDbContext>();
        var publishEndpoint = scope.ServiceProvider.GetRequiredService<IPublishEndpoint>();
        var now = DateTime.UtcNow;

        var candidateId = await db.InventoryOutboxMessages
            .AsNoTracking()
            .Where(message =>
                (message.Status == InventoryOutboxMessageStatus.Pending
                    && message.NextAttemptAtUtc <= now)
                || (message.Status == InventoryOutboxMessageStatus.Processing
                    && message.LockedUntilUtc != null
                    && message.LockedUntilUtc <= now))
            .OrderBy(message => message.OccurredAtUtc)
            .Select(message => (Guid?)message.Id)
            .FirstOrDefaultAsync(ct);

        if (!candidateId.HasValue)
            return false;

        var claimToken = $"{Environment.MachineName}:{Guid.NewGuid():N}";
        var claimed = await db.InventoryOutboxMessages
            .Where(message =>
                message.Id == candidateId.Value
                && ((message.Status == InventoryOutboxMessageStatus.Pending
                        && message.NextAttemptAtUtc <= now)
                    || (message.Status == InventoryOutboxMessageStatus.Processing
                        && message.LockedUntilUtc != null
                        && message.LockedUntilUtc <= now)))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(message => message.Status, InventoryOutboxMessageStatus.Processing)
                .SetProperty(message => message.LockedBy, claimToken)
                .SetProperty(message => message.LockedUntilUtc, now.Add(LeaseDuration))
                .SetProperty(message => message.LastAttemptAtUtc, now), ct);

        if (claimed == 0)
            return true;

        var message = await db.InventoryOutboxMessages
            .AsNoTracking()
            .SingleAsync(row => row.Id == candidateId.Value && row.LockedBy == claimToken, ct);

        try
        {
            if (!string.Equals(message.EventType, SupportedEventType, StringComparison.Ordinal))
                throw new InvalidOperationException($"Unsupported Inventory Outbox event type '{message.EventType}'.");

            var integrationEvent = JsonSerializer.Deserialize<SupplierReceiptApprovedCostRecordedEvent>(
                message.Payload,
                JsonOptions)
                ?? throw new InvalidOperationException("Inventory Outbox payload deserialized to null.");

            await publishEndpoint.Publish(integrationEvent, ct);
            var publishedAt = DateTime.UtcNow;
            await db.InventoryOutboxMessages
                .Where(row => row.Id == message.Id && row.LockedBy == claimToken)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(row => row.Status, InventoryOutboxMessageStatus.Published)
                    .SetProperty(row => row.PublishedAtUtc, publishedAt)
                    .SetProperty(row => row.LastAttemptAtUtc, publishedAt)
                    .SetProperty(row => row.LockedBy, (string?)null)
                    .SetProperty(row => row.LockedUntilUtc, (DateTime?)null)
                    .SetProperty(row => row.LastError, (string?)null), ct);
        }
        catch (Exception ex)
        {
            var retryCount = message.RetryCount + 1;
            var failed = retryCount >= MaxRetryCount
                || ex is JsonException
                || ex is InvalidOperationException;
            var retryAt = DateTime.UtcNow.AddSeconds(Math.Min(300, Math.Pow(2, retryCount)));
            var error = ex.Message.Length <= 1000 ? ex.Message : ex.Message[..1000];

            await db.InventoryOutboxMessages
                .Where(row => row.Id == message.Id && row.LockedBy == claimToken)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(row => row.Status, failed
                        ? InventoryOutboxMessageStatus.Failed
                        : InventoryOutboxMessageStatus.Pending)
                    .SetProperty(row => row.RetryCount, retryCount)
                    .SetProperty(row => row.NextAttemptAtUtc, retryAt)
                    .SetProperty(row => row.LastAttemptAtUtc, DateTime.UtcNow)
                    .SetProperty(row => row.LockedBy, (string?)null)
                    .SetProperty(row => row.LockedUntilUtc, (DateTime?)null)
                    .SetProperty(row => row.LastError, error), ct);

            logger.LogWarning(
                ex,
                "Inventory Outbox event {EventId} failed on attempt {Attempt}. Permanent={Permanent}.",
                message.Id,
                retryCount,
                failed);
        }

        return true;
    }
}
