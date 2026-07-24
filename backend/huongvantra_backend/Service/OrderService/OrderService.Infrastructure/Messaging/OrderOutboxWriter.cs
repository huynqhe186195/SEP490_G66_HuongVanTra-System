using System.Text.Json;
using System.Text.Json.Serialization;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Messaging;

/// <summary>
/// Ghi integration event vào bảng OutboxMessages của OrderService.
///
/// Lớp này chỉ thêm entity vào OrderDbContext hiện tại.
/// Lớp không tự gọi SaveChangesAsync và không publish RabbitMQ,
/// để business data và OutboxMessage có thể được commit cùng transaction.
/// </summary>
public sealed class OrderOutboxWriter(OrderDbContext dbContext) : IOrderOutboxWriter
{
    private const int MaximumEventTypeLength = 200;

    private static readonly JsonSerializerOptions JsonOptions = CreateJsonOptions();

    public async Task EnqueueAsync<TMessage>(
        Guid eventId,
        Guid aggregateId,
        TMessage message,
        CancellationToken ct = default)
        where TMessage : class
    {
        if (eventId == Guid.Empty)
        {
            throw new ArgumentException(
                "Outbox EventId must not be empty.",
                nameof(eventId));
        }

        if (aggregateId == Guid.Empty)
        {
            throw new ArgumentException(
                "Outbox AggregateId must not be empty.",
                nameof(aggregateId));
        }

        ArgumentNullException.ThrowIfNull(message);

        var eventType = typeof(TMessage).FullName
            ?? typeof(TMessage).Name;

        if (eventType.Length > MaximumEventTypeLength)
        {
            throw new InvalidOperationException(
                $"Outbox event type '{eventType}' exceeds " +
                $"{MaximumEventTypeLength} characters.");
        }

        var nowUtc = DateTime.UtcNow;

        var outboxMessage = new OutboxMessage
        {
            Id = eventId,
            EventType = eventType,
            AggregateId = aggregateId,
            Payload = JsonSerializer.Serialize(message, JsonOptions),
            Status = OutboxMessageStatus.Pending,
            RetryCount = 0,
            OccurredAtUtc = nowUtc,
            LastAttemptAtUtc = null,
            NextAttemptAtUtc = nowUtc,
            LockedUntilUtc = null,
            LockedBy = null,
            PublishedAtUtc = null,
            LastError = null
        };

        await dbContext.OutboxMessages.AddAsync(outboxMessage, ct);
    }

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            WriteIndented = false
        };

        options.Converters.Add(new JsonStringEnumConverter());

        return options;
    }
}