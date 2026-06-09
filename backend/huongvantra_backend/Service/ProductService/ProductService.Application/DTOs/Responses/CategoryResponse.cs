namespace ProductService.Application.DTOs.Responses;

public record CategoryResponse(
    int Id,
    string Name,
    string? Description,
    int? ParentId,
    bool IsActive,
    bool IsDeleted,
    DateTime CreatedAt,
    DateTime? SyncedToStoreAt);
