namespace UserService.Application.DTOs.Requests;

public record CreateRoleRequest(string RoleName, string? Description, List<int> PermissionIds);

public record UpdateRoleRequest(string RoleName, string? Description, List<int> PermissionIds);
