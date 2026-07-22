namespace InventoryService.Domain.Entities;

public class InventoryLedgerEntry
{
    public Guid Id { get; set; }
    public Guid TransactionGroupId { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public Guid SkuId { get; set; }
    public string SkuCode { get; set; } = string.Empty;
    public string SkuNameSnapshot { get; set; } = string.Empty;
    public string? ProductTypeSnapshot { get; set; }
    public string? InventoryUnitSnapshot { get; set; }
    public string Location { get; set; } = string.Empty;
    public int QuantityBefore { get; set; }
    public int QuantityDelta { get; set; }
    public int QuantityAfter { get; set; }
    public string TransactionType { get; set; } = string.Empty;
    public string? SourceLocation { get; set; }
    public string? DestinationLocation { get; set; }
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? ReferenceCode { get; set; }
    public Guid? BatchId { get; set; }
    public string? LotCode { get; set; }
    public Guid? ActorId { get; set; }
    public string? ActorName { get; set; }
    public string? ActorRole { get; set; }
    public string? Reason { get; set; }
    public string? Note { get; set; }
    public string? CorrelationId { get; set; }
}
