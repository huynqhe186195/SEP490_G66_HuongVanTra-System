using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.UseCases;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/orders/custom-bundles")]
[Authorize]
public class CustomBundlesController(OrderLogic orderLogic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetPending(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await orderLogic.GetPendingCustomBundlesAsync(page, pageSize, ct));

    [HttpPatch("{id:guid}/pack")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Pack(Guid id, CancellationToken ct) =>
        Ok(await orderLogic.PackCustomBundleAsync(id, ct));
}
