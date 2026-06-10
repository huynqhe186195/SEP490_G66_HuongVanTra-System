using HuongVanTra.Shared.Auth;
using InventoryService.Application.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory")]
[Authorize]
public class InventorySettingsController(IOptions<InventoryOptions> options) : ControllerBase
{
    [HttpGet("settings")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public IActionResult GetSettings() =>
        Ok(new { simulateWarehouse = options.Value.SimulateWarehouse });
}
