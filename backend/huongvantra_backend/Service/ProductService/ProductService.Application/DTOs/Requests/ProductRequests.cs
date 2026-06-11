namespace ProductService.Application.DTOs.Requests;

public record GetProductsRequest(
    string? Search,
    int? CategoryId,
    bool? IsActive,
    bool? IsDeleted,
    int Page = 1,
    int PageSize = 20);

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
    List<ProductImageRequest>? Images,
    List<ProductUnitRequest>? Units,
    List<ProductVariantRequest>? Variants,
    GenerateProductVariantsRequest? VariantGenerator);
