using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Domain.Constants;

namespace UserService.WebAPI.Controllers;

[ApiController]
[Route("api/roles")]
[Authorize]
public class RolesController(RoleLogic roleLogic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> GetAll([FromQuery] bool onlyDeleted = false)
    {
        var result = await roleLogic.GetAllAsync(onlyDeleted);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await roleLogic.GetByIdAsync(id);
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> Create([FromBody] CreateRoleRequest request)
    {
        var result = await roleLogic.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateRoleRequest request)
    {
        await roleLogic.UpdateAsync(id, request);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> Delete(int id)
    {
        await roleLogic.DeleteAsync(id);
        return NoContent();
    }

    [HttpPut("{id:int}/restore")]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> Restore(int id)
    {
        await roleLogic.RestoreAsync(id);
        return NoContent();
    }

    [HttpPost("{id:int}/permissions")]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> AssignPermissions(int id, [FromBody] AssignPermissionsRequest request)
    {
        await roleLogic.AssignPermissionsAsync(id, request.PermissionIds);
        return NoContent();
    }

    [HttpDelete("{id:int}/permissions/{permissionId:int}")]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> RevokePermission(int id, int permissionId)
    {
        await roleLogic.RevokePermissionAsync(id, permissionId);
        return NoContent();
    }

    [HttpGet("{id:int}/permissions")]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> GetPermissions(int id)
    {
        var result = await roleLogic.GetPermissionsAsync(id);
        return Ok(result);
    }
}
