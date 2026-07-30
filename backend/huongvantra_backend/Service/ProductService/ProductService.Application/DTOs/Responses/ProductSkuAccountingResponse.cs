namespace ProductService.Application.DTOs.Responses;

public sealed record ProductSkuAccountingResponse(
    Guid SkuId,
    string SkuCode,
    string ProductName,
    string VariantName,
    string? UnitName,
    decimal RetailPrice,
    decimal AverageCostPrice,
    decimal? LastPurchaseUnitCost,
    Guid? SourceReceiptId,
    string? SourceReceiptCode,
    DateTime? SourceApprovedAt,
    DateTime? CostUpdatedAt);
