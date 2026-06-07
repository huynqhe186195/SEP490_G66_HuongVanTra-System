namespace ProductService.Application.DTOs.Requests;

public record GetProductsRequest(
    string? Search,
    int? CategoryId,
    bool? IsActive,
    int Page = 1,
    int PageSize = 20);

public record CreateProductRequest(
    int CategoryId,
    string Name,
    string? Origin,
    string? FlavorProfile,
    string? BrewingGuide,
    string? Description);

public record UpdateProductRequest(
    int CategoryId,
    string Name,
    string? Origin,
    string? FlavorProfile,
    string? BrewingGuide,
    string? Description,
    bool IsActive);
