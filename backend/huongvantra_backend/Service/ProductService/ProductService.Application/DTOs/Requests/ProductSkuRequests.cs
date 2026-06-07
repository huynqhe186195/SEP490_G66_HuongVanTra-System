namespace ProductService.Application.DTOs.Requests;

public record GetProductSkusRequest(
    string? Search,
    Guid? ProductId,
    bool? IsActive,
    int Page = 1,
    int PageSize = 20);

public record CreateProductSkuRequest(
    Guid ProductId,
    string SkuCode,
    string PackagingType,
    int WeightInGrams,
    decimal BasePrice,
    string? ImageUrl);

public record UpdateProductSkuRequest(
    string SkuCode,
    string PackagingType,
    int WeightInGrams,
    decimal BasePrice,
    string? ImageUrl,
    bool IsActive);
