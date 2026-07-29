namespace InventoryService.Application.Interfaces;

public interface IProductCatalogClient
{
    Task<ProductCatalogSnapshot> GetCatalogAsync(CancellationToken ct = default);
    Task<ProductCatalogSnapshot> GetCatalogForVariantIdsAsync(
        IEnumerable<Guid> variantIds,
        CancellationToken ct = default);
    Task<ProductCatalogSnapshot> GetSupplierReceiptCatalogForVariantIdsAsync(
        IEnumerable<Guid> variantIds,
        CancellationToken ct = default);
}

public sealed record ProductCatalogSnapshot(List<CatalogProduct> Products)
{
    public CatalogProduct? FindProduct(Guid productId) =>
        Products.FirstOrDefault(p => p.Id == productId);

    public CatalogVariant? FindVariant(Guid variantId) =>
        Products.SelectMany(p => p.Variants).FirstOrDefault(v => v.Id == variantId);

    public CatalogProduct? FindProductByVariant(Guid variantId) =>
        Products.FirstOrDefault(p => p.Variants.Any(v => v.Id == variantId));
}

public sealed record CatalogProduct(
    Guid Id,
    string Name,
    string ProductType,
    string InventoryUnit,
    string? BaseUnit,
    bool IsActive,
    List<CatalogVariant> Variants);

public sealed record CatalogVariant(
    Guid Id,
    Guid ProductId,
    string SkuCode,
    string VariantName,
    bool IsActive,
    bool IsSellable,
    bool HasBom,
    int BomLineCount,
    List<CatalogBomLine> BomLines,
    bool IsPurchasable = false,
    bool CanBeBomComponent = false,
    bool CanUseInCustom = false,
    bool CanHaveBom = false,
    bool IsBaseUnitVariant = false,
    Guid? BaseVariantId = null,
    decimal ConversionRate = 0,
    string? UnitName = null);

public sealed record CatalogBomLine(
    Guid MaterialId,
    string MaterialName,
    string? MaterialUnitName,
    decimal Quantity,
    Guid? ComponentVariantId,
    string? ComponentSkuCode,
    string? ComponentVariantName,
    bool IsRequiredBaseComponent);
