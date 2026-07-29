using InventoryService.Domain.Enums;

namespace InventoryService.Domain.Entities;

/// <summary>
/// Durable integration event persisted in the same InventoryService
/// transaction as the originating business change.
/// </summary>
public sealed class InventoryOutboxMessage
{
    public Guid Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public Guid AggregateId { get; set; }
    public Guid SourceId { get; set; }
    public string Payload { get; set; } = string.Empty;
    public InventoryOutboxMessageStatus Status { get; set; } = InventoryOutboxMessageStatus.Pending;
    public int RetryCount { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public DateTime? LastAttemptAtUtc { get; set; }
    public DateTime NextAttemptAtUtc { get; set; }
    public DateTime? LockedUntilUtc { get; set; }
    public string? LockedBy { get; set; }
    public DateTime? PublishedAtUtc { get; set; }
    public string? LastError { get; set; }
}
