using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory")]
[Authorize]
public class MaterialsController(InventoryLogic _logic) : ControllerBase
{
    [HttpPost("deduct-materials")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> DeductMaterials(
        [FromBody] DeductMaterialsRequest request,
        CancellationToken ct)
    {
        await _logic.DeductMaterialsAsync(
            request.Items.Select(i => (i.SkuId, i.Quantity)),
            ct);
        return NoContent();
    }
}
