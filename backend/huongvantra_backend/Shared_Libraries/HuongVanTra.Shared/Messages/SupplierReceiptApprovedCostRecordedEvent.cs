namespace HuongVanTra.Shared.Messages;

/// <summary>
/// Business event emitted after a Supplier Receipt line has been approved and
/// committed together with its stock effect. ProductService remains the owner
/// of the final ProductVariant.CostPrice calculation.
/// </summary>
public sealed record SupplierReceiptApprovedCostRecordedEvent
{
    public Guid EventId { get; init; }
    public Guid SupplierReceiptId { get; init; }
    public Guid SupplierReceiptLineId { get; init; }
    public string ReceiptCode { get; init; } = string.Empty;
    public DateTime ApprovedAt { get; init; }
    public Guid SkuId { get; init; }
    public string SkuCode { get; init; } = string.Empty;
    public decimal ActualQuantity { get; init; }
    public decimal UnitCost { get; init; }
    /// <summary>
    /// Stable one-based order among lines of the same SKU in this receipt.
    /// Legacy events deserialize 0 and are treated as a single-line group.
    /// </summary>
    public int ReceiptLineOrder { get; init; }
    public int ReceiptSkuLineCount { get; init; }
}
