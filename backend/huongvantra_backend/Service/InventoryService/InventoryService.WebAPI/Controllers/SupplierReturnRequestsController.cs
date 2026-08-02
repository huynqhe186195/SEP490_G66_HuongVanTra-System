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

    [HttpGet("defect-reasons")]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public IActionResult GetDefectReasons() => Ok(InventoryLogic.GetSupplierReturnDefectReasons());

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _logic.GetSupplierReturnRequestAsync(id, ct);
        return item == null ? NotFound() : Ok(item);
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> Create([FromBody] CreateSupplierReturnRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });
        var created = await _logic.CreateSupplierReturnRequestAsync(request, userId, User.ToCreatorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }
}
