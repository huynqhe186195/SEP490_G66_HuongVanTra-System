using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/stocktake-requests")]
[Authorize(Roles = "Warehouse,Manager,Admin")]
public class StocktakeRequestsController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
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
    public IActionResult GetReasonCodes() => Ok(InventoryLogic.GetStocktakeReasonCodes());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _logic.GetStocktakeRequestAsync(id, ct);
        return item == null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateStocktakeRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { message = "Khong xac dinh duoc nguoi dung." });

        var created = await _logic.CreateStocktakeRequestAsync(request, userId, User.ToCreatorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { message = "Khong xac dinh duoc nguoi dung." });

        return Ok(await _logic.SubmitStocktakeRequestAsync(id, userId, User.ToCreatorSnapshot(), ct));
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ReviewStocktakeRequest? request, CancellationToken ct)
    {
        var result = await _logic.ApproveStocktakeRequestAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ReviewStocktakeRequest request, CancellationToken ct)
    {
        var result = await _logic.RejectStocktakeRequestAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] ReviewStocktakeRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { message = "Khong xac dinh duoc nguoi dung." });

        var result = await _logic.CancelStocktakeRequestAsync(id, userId, User.IsInRole("Admin"), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }
}
