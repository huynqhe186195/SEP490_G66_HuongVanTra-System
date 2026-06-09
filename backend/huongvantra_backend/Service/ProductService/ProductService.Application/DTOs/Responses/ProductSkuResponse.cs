namespace ProductService.Application.DTOs.Responses;

public record ProductSkuResponse(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string CategoryName,
    string SkuCode,
    string PackagingType,
    int WeightInGrams,
    decimal BasePrice,
    string? ImageUrl,
    bool IsActive,
    DateTime CreatedAt);
