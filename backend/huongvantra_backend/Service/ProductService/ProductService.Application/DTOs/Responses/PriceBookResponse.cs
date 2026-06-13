namespace ProductService.Application.DTOs.Responses;

public record PriceBookResponse(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    bool IsActive,
    DateTime? StartsAt,
    DateTime? EndsAt,
    DateTime CreatedAt,
    List<PriceBookEntryResponse> Entries);

public record PriceBookEntryResponse(
    Guid Id,
    Guid PriceBookId,
    Guid? SkuId,
    Guid? VariantId,
    Guid? UnitId,
    decimal Price,
    bool IsActive,
    DateTime? StartsAt,
    DateTime? EndsAt);
