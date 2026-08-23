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
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
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
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> GetByReturnId(Guid returnId, CancellationToken ct)
    {
        var result = await _logic.GetReturnInspectionsByReturnIdAsync(returnId, ct);
        return Ok(result);
    }

    /// <summary>Quyết định Bán lại / Tiêu hủy — chỉ Thủ kho (OPERATE_WAREHOUSE).</summary>
    [HttpPost("{id:guid}/inspect")]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> Inspect(
        Guid id,
        [FromBody] InspectReturnRequest request,
        CancellationToken ct)
    {
        var result = await _logic.InspectReturnAsync(id, request, User.GetUserId(), ct);
        return Ok(result);
    }
}
