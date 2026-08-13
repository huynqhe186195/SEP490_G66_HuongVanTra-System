namespace ProductService.Domain.Entities;

/// <summary>
/// Durable audit and idempotency record for Supplier Receipt driven average
/// cost updates. SourceReceiptLineId is the authoritative business key.
/// </summary>
public sealed class ProductCostPriceHistory
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Guid SkuId { get; set; }
    public decimal OldCostPrice { get; set; }
    public decimal IncomingUnitCost { get; set; }
    /// <summary>ActualQuantity của dòng phiếu nhập — mẫu số của Weighted Average Cost.</summary>
    public decimal IncomingQuantity { get; set; }
    /// <summary>IncomingQuantity * IncomingUnitCost.</summary>
    public decimal IncomingValue { get; set; }
    /// <summary>
    /// Tồn (Kho + Kệ) trước dòng phiếu — từ Inventory event. 0 = không có / event cũ.
    /// </summary>
    public decimal QuantityOnHandBefore { get; set; }
    public decimal TotalQuantityBefore { get; set; }
    public decimal TotalQuantityAfter { get; set; }
    public decimal TotalValueBefore { get; set; }
    public decimal TotalValueAfter { get; set; }
    public decimal NewCostPrice { get; set; }
    public string SourceType { get; set; } = "supplier_receipt";
    public Guid SourceReceiptId { get; set; }
    public Guid SourceReceiptLineId { get; set; }
    public string SourceReceiptCode { get; set; } = string.Empty;
    public DateTime SourceApprovedAt { get; set; }
    public int ReceiptLineOrder { get; set; } = 1;
    public int ReceiptSkuLineCount { get; set; } = 1;
    public bool WasApplied { get; set; }
    public string ProcessingResult { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
    public string UpdatedBy { get; set; } = "ProductService";
}
