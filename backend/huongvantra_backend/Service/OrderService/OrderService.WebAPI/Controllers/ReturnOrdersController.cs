using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.UseCases;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/returns")]
[Authorize]
public class ReturnOrdersController(OrderLogic _orderLogic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] string? channel,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await _orderLogic.GetReturnsPagedAsync(search, channel, page, pageSize, ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default) =>
        Ok(await _orderLogic.GetReturnByIdAsync(id, ct));
}
