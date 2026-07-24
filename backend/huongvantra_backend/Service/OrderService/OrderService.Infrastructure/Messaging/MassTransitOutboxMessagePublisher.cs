using System.Text.Json;
using System.Text.Json.Serialization;
using MassTransit;
using OrderService.Application.Interfaces;

namespace OrderService.Infrastructure.Messaging;

/// <summary>
/// G5.3 — publish integration event đã lấy từ Outbox lên RabbitMQ qua MassTransit.
///
/// Quy trình:
/// 1. Phân giải EventType qua <see cref="OutboxEventTypeRegistry"/> (allowlist).
///    Không nằm trong allowlist → <see cref="OutboxPermanentPublishException"/> (poison).
/// 2. Deserialize payload theo cùng quy ước JSON với <c>OrderOutboxWriter</c>
///    (Web defaults + JsonStringEnumConverter). Lỗi deserialize → poison.
/// 3. Publish object đúng CLR type để MassTransit định tuyến theo message type,
///    giữ nguyên EventId nằm trong payload để consumer chống trùng.
///
/// Không dùng <c>Type.GetType</c> hay nạp type tuỳ ý lúc runtime.
/// </summary>
public sealed class MassTransitOutboxMessagePublisher(IPublishEndpoint _publishEndpoint)
    : IOutboxMessagePublisher
{
    private static readonly JsonSerializerOptions JsonOptions = CreateJsonOptions();

    public async Task PublishAsync(
        string eventType,
        string payloadJson,
        Guid eventId,
        CancellationToken ct = default)
    {
        if (!OutboxEventTypeRegistry.TryResolve(eventType, out var clrType))
        {
            throw new OutboxPermanentPublishException(
                $"Outbox event type '{eventType}' is not in the publish allowlist.");
        }

        object? message;
        try
        {
            message = JsonSerializer.Deserialize(payloadJson, clrType, JsonOptions);
        }
        catch (JsonException ex)
        {
            throw new OutboxPermanentPublishException(
                $"Outbox event {eventId} of type '{eventType}' has an invalid payload: {ex.Message}");
        }

        if (message is null)
        {
            throw new OutboxPermanentPublishException(
                $"Outbox event {eventId} of type '{eventType}' deserialized to null.");
        }

        // Publish theo đúng runtime type để MassTransit chọn message contract chính xác.
        await _publishEndpoint.Publish(message, clrType, ct);
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
