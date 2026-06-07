using Microsoft.AspNetCore.Authorization;

namespace UserService.Application.Authorization;

public class PermissionRequirement(string permission) : IAuthorizationRequirement
{
    public string Permission { get; } = permission;
}
