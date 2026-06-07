namespace ProductService.Application.DTOs.Requests;

public record CreateCategoryRequest(
    string Name,
    string? Description,
    int? ParentId);

public record UpdateCategoryRequest(
    string Name,
    string? Description,
    int? ParentId);
