using Microsoft.AspNetCore.Authorization;

namespace HuongVanTra.Shared.Auth;

public class AnyPermissionAuthorizationHandler : AuthorizationHandler<AnyPermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        AnyPermissionRequirement requirement)
    {
        if (requirement.Permissions.Any(permission => context.User.HasClaim("permission", permission)))
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
