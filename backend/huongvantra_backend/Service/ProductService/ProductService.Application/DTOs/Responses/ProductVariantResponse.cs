namespace ProductService.Application.DTOs.Responses;

public record ProductImageResponse(
    Guid Id,
    Guid ProductId,
    string ImageUrl,
    string? AltText,
    int SortOrder,
    bool IsThumbnail);

public record ProductUnitResponse(
    Guid Id,
    Guid ProductId,
    Guid? VariantId,
    string UnitName,
    decimal ConversionRate,
    decimal? Price,
    string? Barcode,
    bool IsDirectSell,
    bool IsBaseUnit);

public record ProductVariantResponse(
    Guid Id,
    Guid ProductId,
    string SkuCode,
    string? Barcode,
    string VariantName,
    string OptionValuesJson,
    decimal CostPrice,
    decimal RetailPrice,
    int? MinStock,
    int? MaxStock,
    bool IsSellable,
    bool AllowRewardPoints,
    bool IsActive,
    string? ImageUrl,
    List<ProductUnitResponse> Units);
