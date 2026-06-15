using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/stock-adjustment-requests")]
[Authorize]
public class StockAdjustmentRequestsController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] string? status,
        [FromQuery] bool mine = false,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        Guid? requestedBy = mine ? User.GetUserId() : null;
        if (mine && requestedBy == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var result = await _logic.GetStockAdjustmentRequestsPagedAsync(status, requestedBy, search, page, pageSize, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _logic.GetStockAdjustmentRequestAsync(id, ct);
        if (item == null) return NotFound();
        return Ok(item);
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> Create([FromBody] CreateStockAdjustmentRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });

        var created = await _logic.CreateStockAdjustmentRequestAsync(request, userId, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
    {
        var result = await _logic.ApproveStockAdjustmentRequestAsync(id, User.GetUserId(), ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectStockAdjustmentRequest request, CancellationToken ct)
    {
        var result = await _logic.RejectStockAdjustmentRequestAsync(id, User.GetUserId(), request, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });

        var result = await _logic.CancelStockAdjustmentRequestAsync(id, userId, ct);
        return Ok(result);
    }
}
