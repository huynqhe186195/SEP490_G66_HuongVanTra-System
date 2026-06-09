namespace ProductService.Application.DTOs.Responses;

public record CategoryResponse(
    int Id,
    string Name,
    string? Description,
    int? ParentId,
    bool IsActive,
    DateTime CreatedAt);
