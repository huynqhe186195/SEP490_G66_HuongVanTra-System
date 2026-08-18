namespace UserService.Application.DTOs.Responses;

public record RoleResponse(int Id, string RoleName, string? Description, List<string> Permissions, bool IsDeleted);

public record PermissionResponse(int Id, string PermissionName, string PermissionCode, bool IsDeleted);
