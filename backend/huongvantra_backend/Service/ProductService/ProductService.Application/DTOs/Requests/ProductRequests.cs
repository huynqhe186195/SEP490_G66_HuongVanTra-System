namespace ProductService.Application.DTOs.Requests;

public record BomLineRequest(Guid MaterialId, decimal Quantity);

public record GetProductsRequest(
    string? Search,
    int? CategoryId,
    bool? IsActive,
    bool? IsDeleted,
    string? ProductType,
    int Page = 1,
    int PageSize = 20);

// Legacy request record kept for /api/v1/skus endpoint (now serves ProductVariant data)
public record GetProductSkusRequest(
    string? Search,
    Guid? ProductId,
    bool? IsActive,
    int Page = 1,
    int PageSize = 20);

// Create/Update SKU requests are deprecated — variants are managed through product endpoints
public record CreateProductSkuRequest(
    Guid ProductId,
    string? SkuCode,
    string? Barcode,
    string PackagingType,
    int WeightInGrams,
    decimal BasePrice,
    decimal? CostPrice,
    decimal? RetailPrice,
    int? MinStock,
    int? MaxStock,
    bool IsSellable,
    bool AllowRewardPoints,
    string? ImageUrl);

public record UpdateProductSkuRequest(
    string SkuCode,
    string? Barcode,
    string PackagingType,
    int WeightInGrams,
    decimal BasePrice,
    decimal? CostPrice,
    decimal? RetailPrice,
    int? MinStock,
    int? MaxStock,
    bool IsSellable,
    bool AllowRewardPoints,
    string? ImageUrl,
    bool IsActive);

public record CreateProductRequest(
    int CategoryId,
    string Name,
    string? Origin,
    string? FlavorProfile,
    string? BrewingGuide,
    string? Description,
    string? BaseUnit,
    decimal? WeightValue,
    string? WeightUnit,
    bool IsVariantParent,
    string? ProductType,
    List<ProductImageRequest>? Images,
    List<ProductUnitRequest>? Units,
    List<ProductVariantRequest>? Variants,
    GenerateProductVariantsRequest? VariantGenerator);

public record UpdateProductRequest(
    int CategoryId,
    string Name,
    string? Origin,
    string? FlavorProfile,
    string? BrewingGuide,
    string? Description,
    string? BaseUnit,
    decimal? WeightValue,
    string? WeightUnit,
    bool IsVariantParent,
    bool IsActive,
    string? ProductType,
    List<ProductImageRequest>? Images,
    List<ProductUnitRequest>? Units,
    List<ProductVariantRequest>? Variants,
    GenerateProductVariantsRequest? VariantGenerator);

