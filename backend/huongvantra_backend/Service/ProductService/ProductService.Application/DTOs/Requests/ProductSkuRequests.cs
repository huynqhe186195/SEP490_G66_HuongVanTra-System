namespace ProductService.Application.DTOs.Requests;

public record GetProductSkusRequest(
    string? Search,
    Guid? ProductId,
    bool? IsActive,
    int Page = 1,
    int PageSize = 20);

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
