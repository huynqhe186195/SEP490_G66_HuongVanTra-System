using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/production-orders")]
[Authorize]
public class ProductionOrdersController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20) =>
        Ok(await _logic.GetProductionOrdersAsync(status, page, pageSize, ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _logic.GetProductionOrderByIdAsync(id, ct);
        if (item == null) return NotFound();
        return Ok(item);
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> Create([FromBody] CreateProductionOrderRequest request, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();

        var created = await _logic.CreateProductionOrderAsync(request, User.GetUserId(), User.ToCreatorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPost("{id:guid}/submit")]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();

        var result = await _logic.SubmitProductionOrderAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = PermissionNames.ApproveInventory)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ReviewProductionOrderRequest? request, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();

        var result = await _logic.ApproveProductionOrderAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = PermissionNames.ApproveInventory)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ReviewProductionOrderRequest request, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();

        var result = await _logic.RejectProductionOrderAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/complete")]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();

        var result = await _logic.CompleteProductionOrderAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] ReviewProductionOrderRequest? request, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();

        var current = await _logic.GetProductionOrderByIdAsync(id, ct);
        if (current == null) return NotFound();
        if (!string.Equals(current.Status, "Draft", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Chỉ được hủy lệnh sản xuất ở trạng thái Draft." });

        var result = await _logic.CancelProductionOrderAsync(id, User.GetUserId(), false, User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }
}
