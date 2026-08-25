namespace ProductService.Application.DTOs.Responses;

public record BrandResponse(int Id, string Name, bool IsActive, bool IsDeleted, DateTime CreatedAt, DateTime? UpdatedAt);
