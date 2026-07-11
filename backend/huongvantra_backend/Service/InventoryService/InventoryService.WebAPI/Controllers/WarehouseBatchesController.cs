using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/warehouse-batches")]
[Authorize]
public class WarehouseBatchesController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] Guid? skuId,
        [FromQuery] string? search,
        [FromQuery] bool availableOnly = false) =>
        Ok(await _logic.GetWarehouseBatchesAsync(skuId, search, availableOnly, ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _logic.GetWarehouseBatchAsync(id, ct);
        if (item == null) return NotFound();
        return Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Create([FromBody] CreateWarehouseBatchRequest request, CancellationToken ct)
    {
        var created = await _logic.CreateWarehouseBatchAsync(request, User.GetUserId(), User.ToCreatorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }
}
