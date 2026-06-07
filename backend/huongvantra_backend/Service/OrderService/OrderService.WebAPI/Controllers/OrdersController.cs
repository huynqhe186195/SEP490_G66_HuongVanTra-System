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
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] Guid? customerId,
        [FromQuery] string? status,
        [FromQuery] string? channel,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await _orderLogic.GetPagedAsync(
            new GetOrdersRequest(search, customerId, status, channel, page, pageSize), ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default) =>
        Ok(await _orderLogic.GetByIdAsync(id, ct));

    [HttpGet("by-code/{code}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetByCode(string code, CancellationToken ct = default) =>
        Ok(await _orderLogic.GetByCodeAsync(code, ct));

    [HttpPost]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Create(
        [FromBody] CreateOrderRequest request, CancellationToken ct = default)
    {
        var result = await _orderLogic.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] UpdateOrderRequest request, CancellationToken ct = default) =>
        Ok(await _orderLogic.UpdateAsync(id, request, ct));

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Cancel(
        Guid id, [FromBody] CancelOrderRequest request, CancellationToken ct = default)
    {
        await _orderLogic.CancelAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/ship")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> MarkShipping(Guid id, CancellationToken ct = default)
    {
        await _orderLogic.MarkShippingAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/complete")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct = default)
    {
        await _orderLogic.CompleteAsync(id, ct);
        return NoContent();
    }
}
