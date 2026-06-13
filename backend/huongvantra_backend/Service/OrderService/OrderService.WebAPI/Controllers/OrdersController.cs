using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.UseCases;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/orders")]
[Authorize]
public class OrdersController(OrderLogic _orderLogic) : ControllerBase
{
    private (Guid? ActorId, string? ActorName) GetActor() =>
        (User.GetUserId() is var id && id != Guid.Empty ? id : null, User.GetUsername());
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] Guid? customerId,
        [FromQuery] string? status,
        [FromQuery] string? channel,
        [FromQuery] string? excludeChannel,
        [FromQuery] string? codTab,
        [FromQuery] bool returnableOnly = false,
        [FromQuery] string? orderKind = null,
        [FromQuery] string? excludeOrderKind = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] Guid? employeeId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await _orderLogic.GetPagedAsync(
            new GetOrdersRequest(search, customerId, status, channel, excludeChannel, codTab, returnableOnly, orderKind, excludeOrderKind, fromDate, toDate, employeeId, page, pageSize), ct));

    [HttpGet("return-slips")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetReturnSlips(
        [FromQuery] string? search,
        [FromQuery] string? channel,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await _orderLogic.GetReturnsPagedAsync(search, channel, page, pageSize, ct));

    [HttpGet("return-slips/{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetReturnSlipById(Guid id, CancellationToken ct = default) =>
        Ok(await _orderLogic.GetReturnByIdAsync(id, ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default) =>
        Ok(await _orderLogic.GetByIdAsync(id, ct));

    [HttpGet("{id:guid}/activities")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetActivities(Guid id, CancellationToken ct = default) =>
        Ok(await _orderLogic.GetActivitiesAsync(id, ct));

    [HttpGet("{id:guid}/returns")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetReturns(Guid id, CancellationToken ct = default) =>
        Ok(await _orderLogic.GetReturnsByOrderIdAsync(id, ct));

    [HttpGet("by-code/{code}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetByCode(string code, CancellationToken ct = default) =>
        Ok(await _orderLogic.GetByCodeAsync(code, ct));

    [HttpPost]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Create(
        [FromBody] CreateOrderRequest request, CancellationToken ct = default)
    {
        var (actorId, actorName) = GetActor();
        var result = await _orderLogic.CreateAsync(request, actorId, actorName, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] UpdateOrderRequest request, CancellationToken ct = default)
    {
        var (actorId, actorName) = GetActor();
        return Ok(await _orderLogic.UpdateAsync(id, request, actorId, actorName, ct));
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Cancel(
        Guid id, [FromBody] CancelOrderRequest request, CancellationToken ct = default)
    {
        var (actorId, actorName) = GetActor();
        await _orderLogic.CancelAsync(id, request.Reason, actorId, actorName, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/ship")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> MarkShipping(Guid id, CancellationToken ct = default)
    {
        var (actorId, actorName) = GetActor();
        await _orderLogic.MarkShippingAsync(id, actorId, actorName, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/complete")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct = default)
    {
        var (actorId, actorName) = GetActor();
        await _orderLogic.CompleteAsync(id, actorId, actorName, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/return")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Return(
        Guid id, [FromBody] ReturnOrderRequest request, CancellationToken ct = default)
    {
        var (actorId, actorName) = GetActor();
        var result = await _orderLogic.ReturnAsync(id, request, actorId, actorName, ct);
        return CreatedAtAction(nameof(GetById), new { id }, result);
    }
}
