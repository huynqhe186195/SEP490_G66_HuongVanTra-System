using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/production-orders")]
[Authorize(Roles = "Warehouse")]
public class ProductionOrdersController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20) =>
        Ok(await _logic.GetProductionOrdersAsync(status, page, pageSize, ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _logic.GetProductionOrderByIdAsync(id, ct);
        if (item == null) return NotFound();
        return Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductionOrderRequest request, CancellationToken ct)
    {
        var created = await _logic.CreateProductionOrderAsync(request, User.GetUserId(), ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct)
    {
        var result = await _logic.CompleteProductionOrderAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var result = await _logic.CancelProductionOrderAsync(id, User.GetUserId(), ct);
        return Ok(result);
    }
}
