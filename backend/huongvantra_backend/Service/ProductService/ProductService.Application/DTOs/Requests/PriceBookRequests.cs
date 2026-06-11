namespace ProductService.Application.DTOs.Requests;

public record GetPriceBooksRequest(
    string? Search,
    bool? IsActive,
    int Page = 1,
    int PageSize = 20);

public record CreatePriceBookRequest(
    string? Code,
    string Name,
    string? Description,
    bool IsActive,
    DateTime? StartsAt,
    DateTime? EndsAt,
    List<PriceBookEntryRequest>? Entries);

public record UpdatePriceBookRequest(
    string? Code,
    string Name,
    string? Description,
    bool IsActive,
    DateTime? StartsAt,
    DateTime? EndsAt,
    List<PriceBookEntryRequest>? Entries);

public record PriceBookEntryRequest(
    Guid? SkuId,
    Guid? VariantId,
    Guid? UnitId,
    decimal Price,
    bool IsActive,
    DateTime? StartsAt,
    DateTime? EndsAt);
