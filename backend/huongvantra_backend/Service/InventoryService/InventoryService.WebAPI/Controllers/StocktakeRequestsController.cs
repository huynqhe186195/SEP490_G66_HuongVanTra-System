using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/stocktake-requests")]
[Authorize]
public class StocktakeRequestsController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Warehouse,Manager,Admin,Accountant")]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] string? status,
        [FromQuery] string? location,
        [FromQuery] bool mine = false,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        Guid? createdBy = mine ? User.GetUserId() : null;
        if (mine && createdBy == Guid.Empty)
            return Unauthorized(new { message = "Khong xac dinh duoc nguoi dung." });

        return Ok(await _logic.GetStocktakeRequestsAsync(status, location, createdBy, search, page, pageSize, ct));
    }

    [HttpGet("reason-codes")]
    [Authorize(Roles = "Warehouse,Manager,Admin,Accountant")]
    public IActionResult GetReasonCodes() => Ok(InventoryLogic.GetStocktakeReasonCodes());

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Warehouse,Manager,Admin,Accountant")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _logic.GetStocktakeRequestAsync(id, ct);
        return item == null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> Create([FromBody] CreateStocktakeRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { message = "Khong xac dinh duoc nguoi dung." });

        var created = await _logic.CreateStocktakeRequestAsync(request, userId, User.ToCreatorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPost("{id:guid}/submit")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { message = "Khong xac dinh duoc nguoi dung." });

        return Ok(await _logic.SubmitStocktakeRequestAsync(id, userId, User.ToCreatorSnapshot(), ct));
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ReviewStocktakeRequest? request, CancellationToken ct)
    {
        var result = await _logic.ApproveStocktakeRequestAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ReviewStocktakeRequest request, CancellationToken ct)
    {
        var result = await _logic.RejectStocktakeRequestAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] ReviewStocktakeRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { message = "Khong xac dinh duoc nguoi dung." });

        var result = await _logic.CancelStocktakeRequestAsync(id, userId, User.IsInRole("Admin"), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }
}
