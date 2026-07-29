using HuongVanTra.Shared.Messages;
using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using MassTransit;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace InventoryService.Infrastructure.Messaging;

public class InventoryEventPublisher(
    IPublishEndpoint _publishEndpoint,
    InventoryDbContext _db) : IInventoryEventPublisher
{
    private static readonly JsonSerializerOptions OutboxJsonOptions = CreateJsonOptions();

    public Task PublishStockDeductedAsync(
        Guid orderId, string orderCode, bool success, CancellationToken ct = default) =>
        _publishEndpoint.Publish(new StockDeductedEvent
        {
            EventId = Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = orderCode,
            Success = success,
            Status = success ? "deducted" : "failed"
        }, ct);

    public Task PublishStockDeductionCancelledAsync(
        Guid orderId, string orderCode, string reason, CancellationToken ct = default) =>
        _publishEndpoint.Publish(new StockDeductedEvent
        {
            EventId = Guid.NewGuid(),
            OccurredAtUtc = DateTime.UtcNow,
            OrderId = orderId,
            OrderCode = orderCode,
            Success = false,
            Status = "cancelled",
            Reason = reason
        }, ct);

    public Task PublishLowStockAsync(
        Guid skuId, string skuCode, int currentStock, int threshold, CancellationToken ct = default) =>
        _publishEndpoint.Publish(new LowStockEvent
        {
            SkuId = skuId,
            SkuCode = skuCode,
            CurrentStock = currentStock,
            Threshold = threshold,
            OccurredAt = DateTime.UtcNow
        }, ct);

    public async Task EnqueueSupplierReceiptCostRecordedAsync(
        SupplierReceiptApprovedCostRecordedEvent message,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(message);
        if (message.EventId == Guid.Empty
            || message.SupplierReceiptId == Guid.Empty
            || message.SupplierReceiptLineId == Guid.Empty)
        {
            throw new ArgumentException("Supplier Receipt cost event identity is invalid.", nameof(message));
        }

        var eventType = typeof(SupplierReceiptApprovedCostRecordedEvent).FullName
            ?? nameof(SupplierReceiptApprovedCostRecordedEvent);
        var now = DateTime.UtcNow;
        await _db.InventoryOutboxMessages.AddAsync(new InventoryOutboxMessage
        {
            Id = message.EventId,
            EventType = eventType,
            AggregateId = message.SupplierReceiptId,
            SourceId = message.SupplierReceiptLineId,
            Payload = JsonSerializer.Serialize(message, OutboxJsonOptions),
            Status = InventoryOutboxMessageStatus.Pending,
            RetryCount = 0,
            OccurredAtUtc = now,
            NextAttemptAtUtc = now
        }, ct);
    }

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        return options;
    }
}
