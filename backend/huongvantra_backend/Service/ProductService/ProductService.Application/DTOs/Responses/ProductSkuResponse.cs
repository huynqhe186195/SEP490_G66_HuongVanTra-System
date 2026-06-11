namespace ProductService.Application.DTOs.Responses;

public record ProductSkuResponse(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string CategoryName,
    string SkuCode,
    string? Barcode,
    string PackagingType,
    int WeightInGrams,
    decimal BasePrice,
    decimal CostPrice,
    decimal RetailPrice,
    int? MinStock,
    int? MaxStock,
    bool IsSellable,
    bool AllowRewardPoints,
    string? ImageUrl,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? SyncedToStoreAt);
