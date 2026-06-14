namespace ProductService.Application.DTOs.Requests;

public record CreateBrandRequest(string Name);
public record UpdateBrandRequest(string Name, bool? IsActive);
