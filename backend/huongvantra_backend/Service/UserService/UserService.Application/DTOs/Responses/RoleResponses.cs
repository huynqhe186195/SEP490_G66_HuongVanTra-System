namespace UserService.Application.DTOs.Responses;

public record RoleResponse(int Id, string RoleName, string? Description, List<string> Permissions, bool IsDeleted);

public record PermissionResponse(int Id, string PermissionName, string PermissionCode, bool IsDeleted);

/// <summary>Vai trò chỉ cho phép 1 người đang hoạt động — dùng để khóa ô tick tương ứng trên giao diện.</summary>
public record SingleHolderRoleStatusResponse(
    string RoleName,
    string Label,
    bool IsTaken,
    Guid? HolderUserId,
    string? HolderName);

