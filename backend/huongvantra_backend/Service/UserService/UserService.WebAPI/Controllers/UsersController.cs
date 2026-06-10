using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Domain.Constants;

namespace UserService.WebAPI.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController(UserLogic userLogic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ManageUser)]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] bool onlyDeleted = false)
    {
        var result = await userLogic.GetAllAsync(page, pageSize, onlyDeleted);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var currentUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")!);
        if (id != currentUserId && !User.HasClaim("permission", PermissionNames.ManageUser))
            return Forbid();

        var result = await userLogic.GetByIdAsync(id);
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.ManageUser)]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        var result = await userLogic.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageUser)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request)
    {
        await userLogic.UpdateAsync(id, request);
        return NoContent();
    }

    [HttpPut("{id:guid}/lock")]
    [Authorize(Policy = PermissionNames.ManageUser)]
    public async Task<IActionResult> Lock(Guid id)
    {
        await userLogic.LockAsync(id);
        return NoContent();
    }

    [HttpPut("{id:guid}/unlock")]
    [Authorize(Policy = PermissionNames.ManageUser)]
    public async Task<IActionResult> Unlock(Guid id)
    {
        await userLogic.UnlockAsync(id);
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
    [Authorize(Policy = PermissionNames.ManageUser)]
    public async Task<IActionResult> AssignRoles(Guid id, [FromBody] AssignRolesRequest request)
    {
        await userLogic.AssignRolesAsync(id, request);
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
    [Authorize(Policy = PermissionNames.ManageUser)]
    public async Task<IActionResult> GetRoles(Guid id)
    {
        var result = await userLogic.GetRolesAsync(id);
        return Ok(result);
    }
}
