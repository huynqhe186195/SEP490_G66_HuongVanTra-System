namespace ProductService.Application.DTOs.Responses;

public record ProductBomCatalogResponse(
    List<ProductBomCatalogProductResponse> Products);

public record ProductBomCatalogProductResponse(
    Guid Id,
    string Name,
    string ProductType,
    string InventoryUnit,
    string? BaseUnit,
    bool IsActive,
    List<ProductBomCatalogVariantResponse> Variants);

public record ProductBomCatalogVariantResponse(
    Guid Id,
    Guid ProductId,
    string SkuCode,
    string VariantName,
    bool IsActive,
    bool IsSellable,
    bool IsPurchasable,
    bool CanBeBomComponent,
    bool CanUseInCustom,
    bool CanHaveBom,
    bool IsBaseUnitVariant,
    Guid? BaseVariantId,
    decimal ConversionRate,
    bool HasBom,
    int BomLineCount,
    List<BomLineResponse> BomLines);
