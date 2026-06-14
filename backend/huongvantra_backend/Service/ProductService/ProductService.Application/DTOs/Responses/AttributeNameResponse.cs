namespace ProductService.Application.DTOs.Responses;

public record AttributeNameResponse(int Id, string Name, bool IsActive, bool IsDeleted, DateTime CreatedAt);
