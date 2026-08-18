namespace UserService.Application.DTOs.Requests;

public class CreatePermissionRequest
{
    public string PermissionName { get; set; } = string.Empty;
    public string PermissionCode { get; set; } = string.Empty;
}
