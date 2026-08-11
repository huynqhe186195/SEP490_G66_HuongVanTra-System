namespace HuongVanTra.Shared.Messages;

/// <summary>Phát sau khi Customer Service tự động nâng hạng khách hàng cá nhân.</summary>
public record CustomerTierUpgradedEvent
{
    public Guid EventId { get; init; }
    public DateTime OccurredAtUtc { get; init; }
    public Guid OrderId { get; init; }
    public Guid CustomerId { get; init; }
    public string CustomerName { get; init; } = string.Empty;
    public string CustomerEmail { get; init; } = string.Empty;
    public string PreviousTierName { get; init; } = string.Empty;
    public string NewTierName { get; init; } = string.Empty;
    public decimal TotalSpending { get; init; }
}
