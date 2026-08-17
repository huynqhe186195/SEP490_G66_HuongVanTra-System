namespace UserService.Domain.Entities;

public class Permission : BaseEntity
{
    public int Id { get; set; }
    public string PermissionName { get; set; } = string.Empty;
    public string PermissionCode { get; set; } = string.Empty;

    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();

    public string AuthorizationCode =>
        string.IsNullOrWhiteSpace(PermissionCode) ? PermissionName : PermissionCode;
}
