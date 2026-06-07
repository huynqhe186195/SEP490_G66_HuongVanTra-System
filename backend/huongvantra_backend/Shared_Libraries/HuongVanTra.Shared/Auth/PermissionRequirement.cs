using Microsoft.AspNetCore.Authorization;

namespace HuongVanTra.Shared.Auth;

public class PermissionRequirement(string permission) : IAuthorizationRequirement
{
    public string Permission { get; } = permission;
}
