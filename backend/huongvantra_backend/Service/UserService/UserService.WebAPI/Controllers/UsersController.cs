using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Domain.Constants;
using UserService.WebAPI.Extensions;

namespace UserService.WebAPI.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController(UserLogic userLogic) : ControllerBase
{
    private IReadOnlyList<string> ActorPermissions => User.GetPermissions().ToList();

    private bool CanManageStaffAccounts() =>
        User.HasClaim("permission", PermissionNames.ManageUser)
        || User.HasClaim("permission", PermissionNames.ManageEmployee);
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] bool onlyDeleted = false)
    {
        if (User.HasClaim("permission", PermissionNames.ManageUser))
            return Ok(await userLogic.GetAllAsync(page, pageSize, onlyDeleted));

        if (CanManageStaffAccounts() || User.HasClaim("permission", PermissionNames.ViewAllCustomers))
            return Ok(await userLogic.GetAllAccessibleAsync(page, pageSize, ActorPermissions, onlyDeleted));

        return Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var currentUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")!);

        if (id == currentUserId)
            return Ok(await userLogic.GetByIdAsync(id));

        if (User.HasClaim("permission", PermissionNames.ManageUser))
            return Ok(await userLogic.GetByIdAsync(id));

        if (CanManageStaffAccounts())
            return Ok(await userLogic.GetByIdAsync(id, ActorPermissions));

        return Forbid();
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.ManageUser)]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        var result = await userLogic.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request)
    {
        if (!CanManageStaffAccounts()) return Forbid();
        await userLogic.UpdateAsync(id, request, ActorPermissions);
        return NoContent();
    }

    [HttpPut("{id:guid}/lock")]
    public async Task<IActionResult> Lock(Guid id)
    {
        if (!CanManageStaffAccounts()) return Forbid();
        await userLogic.LockAsync(id, ActorPermissions);
        return NoContent();
    }

    [HttpPut("{id:guid}/unlock")]
    public async Task<IActionResult> Unlock(Guid id)
    {
        if (!CanManageStaffAccounts()) return Forbid();
        await userLogic.UnlockAsync(id, ActorPermissions);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageUser)]
    public async Task<IActionResult> Delete(Guid id)
    {
        await userLogic.SoftDeleteAsync(id);
        return NoContent();
    }

    [HttpPut("{id:guid}/restore")]
    [Authorize(Policy = PermissionNames.ManageUser)]
    public async Task<IActionResult> Restore(Guid id)
    {
        await userLogic.RestoreAsync(id);
        return NoContent();
    }

    [HttpPut("{id:guid}/change-password")]
    public async Task<IActionResult> ChangePassword(Guid id, [FromBody] ChangePasswordRequest request)
    {
        await userLogic.ChangePasswordAsync(id, request);
        return NoContent();
    }

    [HttpPost("{id:guid}/roles")]
    public async Task<IActionResult> AssignRoles(Guid id, [FromBody] AssignRolesRequest request)
    {
        if (!CanManageStaffAccounts()) return Forbid();
        await userLogic.AssignRolesAsync(id, request, ActorPermissions);
        return NoContent();
    }

    [HttpDelete("{id:guid}/roles/{roleId:int}")]
    [Authorize(Policy = PermissionNames.ManageUser)]
    public async Task<IActionResult> RevokeRole(Guid id, int roleId)
    {
        await userLogic.RevokeRoleAsync(id, roleId);
        return NoContent();
    }

    [HttpGet("{id:guid}/roles")]
    public async Task<IActionResult> GetRoles(Guid id)
    {
        var currentUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")!);

        if (id == currentUserId)
            return Ok(await userLogic.GetRolesAsync(id));

        if (User.HasClaim("permission", PermissionNames.ManageUser))
            return Ok(await userLogic.GetRolesAsync(id));

        if (CanManageStaffAccounts())
            return Ok(await userLogic.GetRolesAsync(id, ActorPermissions));

        return Forbid();
    }
}
