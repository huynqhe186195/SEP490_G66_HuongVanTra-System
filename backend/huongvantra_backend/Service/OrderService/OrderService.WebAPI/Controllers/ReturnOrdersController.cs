using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.UseCases;
using OrderService.WebAPI.Authorization;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/returns")]
[Authorize]
public class ReturnOrdersController(
    OrderLogic orderLogic,
    ReturnPolicyLogic returnPolicyLogic) : ControllerBase
{
    private OrderAccessContext AccessContext() => User.CreateOrderAccessContext();

    private (Guid? ActorId, string? ActorName) Actor() =>
    (
        User.GetUserId() is var id && id != Guid.Empty ? id : null,
        User.GetDisplayName()
    );

    /// <summary>Phase 1: đọc chính sách trả/đổi hàng đang hiệu lực.</summary>
    [HttpGet("policy")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetActivePolicy(CancellationToken ct = default) =>
        Ok(await returnPolicyLogic.GetActivePolicyAsync(ct));

    /// <summary>Phase 1: policy + cảnh báo mềm theo ngữ cảnh đơn.</summary>
    [HttpGet("policy/for-order/{orderId:guid}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetPolicyForOrder(Guid orderId, CancellationToken ct = default) =>
        Ok(await returnPolicyLogic.GetPolicyForOrderAsync(orderId, AccessContext(), ct));

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

    /// <summary>Phase 4: Manager Accept phiếu Pending → hoàn tiền + OrderReturned.</summary>
    [HttpPost("{id:guid}/accept")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Accept(Guid id, CancellationToken ct = default)
    {
        var (actorId, actorName) = Actor();
        return Ok(await orderLogic.AcceptReturnAsync(id, AccessContext(), actorId, actorName, ct));
    }

    /// <summary>Phase 4: Manager từ chối phiếu Pending — không hoàn tiền, không inspection.</summary>
    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Reject(
        Guid id,
        [FromBody] RejectReturnRequest? request,
        CancellationToken ct = default)
    {
        var (actorId, actorName) = Actor();
        return Ok(await orderLogic.RejectReturnAsync(
            id, request ?? new RejectReturnRequest(), AccessContext(), actorId, actorName, ct));
    }
}
