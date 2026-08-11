namespace OrderService.Domain.Entities;

public sealed class TierUpgradeEmailDelivery
{
    public Guid EventId { get; set; }
    public Guid CustomerId { get; set; }
    public string TierName { get; set; } = string.Empty;
    public DateTime ReceivedAtUtc { get; set; }
    public DateTime? SentAtUtc { get; set; }
    public int AttemptCount { get; set; }
    public string? LastError { get; set; }
}
