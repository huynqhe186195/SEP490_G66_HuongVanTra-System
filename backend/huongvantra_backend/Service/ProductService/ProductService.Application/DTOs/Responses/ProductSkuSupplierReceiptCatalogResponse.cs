namespace ProductService.Application.DTOs.Responses;

/// <summary>
/// Minimal internal catalog for Supplier Receipt validation. It deliberately
/// excludes BOM data because receiving from a supplier is not a sell-first flow.
/// </summary>
public record ProductSkuSupplierReceiptCatalogResponse(
    Guid SkuId,
    Guid ProductId,
    string ProductName,
    string SkuCode,
    string? VariantName,
    string? UnitName,
    string ProductType,
    string InventoryUnit,
    bool IsActive,
    bool IsPurchasable);
