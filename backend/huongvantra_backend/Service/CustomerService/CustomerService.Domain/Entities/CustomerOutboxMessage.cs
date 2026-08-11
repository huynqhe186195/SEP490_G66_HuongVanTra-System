namespace CustomerService.Domain.Entities;

public sealed class CustomerOutboxMessage
{
    public Guid Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public Guid AggregateId { get; set; }
    public string Payload { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public int RetryCount { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public DateTime NextAttemptAtUtc { get; set; }
    public DateTime? PublishedAtUtc { get; set; }
    public string? LastError { get; set; }
}
