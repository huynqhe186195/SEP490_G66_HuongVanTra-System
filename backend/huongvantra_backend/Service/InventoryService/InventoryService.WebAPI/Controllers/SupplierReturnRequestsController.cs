using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/supplier-return-requests")]
[Authorize]
public class SupplierReturnRequestsController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] string? status,
        [FromQuery] bool mine = false,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        Guid? createdBy = mine ? User.GetUserId() : null;
        if (mine && createdBy == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng." });

        return Ok(await _logic.GetSupplierReturnRequestsAsync(status, createdBy, search, page, pageSize, ct));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _logic.GetSupplierReturnRequestAsync(id, ct);
        return item == null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.ApproveInventory)]
    public async Task<IActionResult> Create([FromBody] CreateSupplierReturnRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });
        var created = await _logic.CreateSupplierReturnRequestAsync(request, userId, User.ToCreatorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = PermissionNames.ApproveInventory)]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
    {
        var result = await _logic.ApproveSupplierReturnRequestAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = PermissionNames.ApproveInventory)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ReviewInventoryReturnRequest request, CancellationToken ct)
    {
        var result = await _logic.RejectSupplierReturnRequestAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = PermissionNames.ApproveInventory)]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] ReviewInventoryReturnRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });
        var result = await _logic.CancelSupplierReturnRequestAsync(id, userId, User.IsInRole("Manager"), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }
}
