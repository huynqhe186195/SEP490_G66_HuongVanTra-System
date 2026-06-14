namespace ProductService.Application.DTOs.Requests;

public record CreateAttributeNameRequest(string Name);
public record UpdateAttributeNameRequest(string Name, bool? IsActive);
