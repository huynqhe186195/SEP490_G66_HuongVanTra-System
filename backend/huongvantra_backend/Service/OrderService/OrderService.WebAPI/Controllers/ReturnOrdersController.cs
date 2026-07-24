using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.Authorization;
using OrderService.Application.UseCases;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/returns")]
[Authorize]
public class ReturnOrdersController(OrderLogic orderLogic) : ControllerBase
{
    private OrderAccessContext AccessContext()
    {
        var canViewAll = User.HasPermission(PermissionNames.ManageEmployee)
            || User.HasPermission(PermissionNames.ManageRole)
            || User.HasPermission(PermissionNames.ViewAllCustomers);
        var codOnly = !canViewAll && User.HasPermission(PermissionNames.VerifyCod);
        return new OrderAccessContext(User.GetUserId(), canViewAll, codOnly);
    }

    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] string? channel,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await orderLogic.GetReturnsPagedAsync(search, channel, AccessContext(), page, pageSize, ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default) =>
        Ok(await orderLogic.GetReturnByIdAsync(id, AccessContext(), ct));
}
