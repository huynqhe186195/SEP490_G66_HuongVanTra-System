using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/shelf-return-requests")]
[Authorize]
public class ShelfReturnRequestsController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Warehouse,Manager,Admin,Accountant")]
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

        return Ok(await _logic.GetShelfReturnRequestsAsync(status, createdBy, search, page, pageSize, ct));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Warehouse,Manager,Admin,Accountant")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _logic.GetShelfReturnRequestAsync(id, ct);
        return item == null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> Create([FromBody] CreateShelfReturnRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });
        var created = await _logic.CreateShelfReturnRequestAsync(request, userId, User.ToCreatorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
    {
        var result = await _logic.ApproveShelfReturnRequestAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ReviewInventoryReturnRequest request, CancellationToken ct)
    {
        var result = await _logic.RejectShelfReturnRequestAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] ReviewInventoryReturnRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });
        var result = await _logic.CancelShelfReturnRequestAsync(id, userId, User.IsInRole("Admin"), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }
}
