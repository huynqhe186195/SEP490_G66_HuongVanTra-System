using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/shelf-replenishment-suggestions")]
[Authorize]
public class ShelfReplenishmentSuggestionsController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20) =>
        Ok(await _logic.GetShelfReplenishmentSuggestionsAsync(status, search, page, pageSize, ct));

    [HttpGet("open-count")]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetOpenCount(CancellationToken ct) =>
        Ok(new { count = await _logic.CountOpenShelfReplenishmentSuggestionsAsync(ct) });

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var suggestion = await _logic.GetShelfReplenishmentSuggestionAsync(id, ct);
        return suggestion is null ? NotFound() : Ok(suggestion);
    }

    [HttpPost("{id:guid}/dismiss")]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> Dismiss(
        Guid id,
        [FromBody] DismissShelfReplenishmentSuggestionRequest request,
        CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();
        var actorId = User.GetUserId();
        if (actorId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });
        return Ok(await _logic.DismissShelfReplenishmentSuggestionAsync(
            id, actorId, User.ToCreatorSnapshot(), request, ct));
    }
}
