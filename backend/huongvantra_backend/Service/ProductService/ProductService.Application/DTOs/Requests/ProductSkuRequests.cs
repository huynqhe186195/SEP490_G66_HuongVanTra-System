namespace ProductService.Application.DTOs.Requests;

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
