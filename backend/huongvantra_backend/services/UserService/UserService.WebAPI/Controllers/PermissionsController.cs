using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Domain.Constants;

namespace UserService.WebAPI.Controllers;

[ApiController]
[Route("api/permissions")]
[Authorize(Policy = PermissionNames.ManageRole)]
public class PermissionsController(PermissionLogic permissionLogic) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool onlyDeleted = false)
    {
        var result = await permissionLogic.GetAllAsync(onlyDeleted);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePermissionRequest request)
    {
        var result = await permissionLogic.CreateAsync(request);
        return CreatedAtAction(nameof(GetAll), result);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> SoftDelete(int id)
    {
        await permissionLogic.SoftDeleteAsync(id);
        return NoContent();
    }

    [HttpPut("{id:int}/restore")]
    public async Task<IActionResult> Restore(int id)
    {
        await permissionLogic.RestoreAsync(id);
        return NoContent();
    }
}
