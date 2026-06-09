namespace ProductService.Application.DTOs.Responses;

public record ProductResponse(
    Guid Id,
    int CategoryId,
    string CategoryName,
    string Name,
    string? Origin,
    string? FlavorProfile,
    string? BrewingGuide,
    string? Description,
    bool IsActive,
    bool IsDeleted,
    DateTime CreatedAt,
    DateTime? SyncedToStoreAt,
    List<ProductSkuResponse> Skus);
