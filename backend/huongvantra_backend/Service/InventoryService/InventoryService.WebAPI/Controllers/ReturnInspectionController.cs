using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/return-inspections")]
[Authorize]
public class ReturnInspectionController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Warehouse,Manager,Admin,Staff")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? disposition,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _logic.GetReturnInspectionsPagedAsync(disposition, search, page, pageSize, ct);
        return Ok(result);
    }

    [HttpGet("by-return/{returnId:guid}")]
    [Authorize(Roles = "Warehouse,Manager,Admin,Staff")]
    public async Task<IActionResult> GetByReturnId(Guid returnId, CancellationToken ct)
    {
        var result = await _logic.GetReturnInspectionsByReturnIdAsync(returnId, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/inspect")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> Inspect(
        Guid id,
        [FromBody] InspectReturnRequest request,
        CancellationToken ct)
    {
        var result = await _logic.InspectReturnAsync(id, request, User.GetUserId(), ct);
        return Ok(result);
    }
}
