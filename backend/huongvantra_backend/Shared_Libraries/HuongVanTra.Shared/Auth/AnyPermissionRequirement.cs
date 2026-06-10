using Microsoft.AspNetCore.Authorization;

namespace HuongVanTra.Shared.Auth;

public sealed class AnyPermissionRequirement : IAuthorizationRequirement
{
    public AnyPermissionRequirement(params string[] permissions)
    {
        Permissions = permissions;
    }

    public IReadOnlyList<string> Permissions { get; }
}
