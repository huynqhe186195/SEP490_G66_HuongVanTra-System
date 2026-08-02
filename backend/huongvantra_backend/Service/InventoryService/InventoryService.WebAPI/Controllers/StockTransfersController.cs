using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/stock-transfers")]
[Authorize]
public class StockTransfersController(StockTransferLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] Guid? sourceRequestId = null,
        [FromQuery] string? transferType = null,
        [FromQuery] Guid? createdBy = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] string? sort = null) =>
        Ok(await _logic.GetPagedAsync(
            status,
            search,
            page,
            pageSize,
            ct,
            sourceRequestId,
            transferType,
            createdBy,
            NormalizeFromDate(fromDate),
            NormalizeToDate(toDate),
            sort));

    /// <summary>Ngày lọc gửi lên theo ngày địa phương; quy về mốc đầu ngày UTC để so sánh CreatedAt.</summary>
    private static DateTime? NormalizeFromDate(DateTime? value) =>
        value.HasValue ? DateTime.SpecifyKind(value.Value.Date, DateTimeKind.Utc) : null;

    /// <summary>Ngày kết thúc lấy trọn ngày: dùng mốc đầu ngày kế tiếp và so sánh nhỏ hơn.</summary>
    private static DateTime? NormalizeToDate(DateTime? value) =>
        value.HasValue ? DateTime.SpecifyKind(value.Value.Date.AddDays(1), DateTimeKind.Utc) : null;

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var transfer = await _logic.GetByIdAsync(id, ct);
        return transfer is null ? NotFound() : Ok(transfer);
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> Create([FromBody] UpsertStockTransferRequest request, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();
        var actorId = User.GetUserId();
        if (actorId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });
        var created = await _logic.CreateAsync(request, actorId, User.ToCreatorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = created.TransferId }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertStockTransferRequest request, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();
        var actorId = User.GetUserId();
        if (actorId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });
        return Ok(await _logic.UpdateAsync(id, request, actorId, ct));
    }

    [HttpPost("{id:guid}/complete")]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();
        var actorId = User.GetUserId();
        if (actorId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });
        return Ok(await _logic.CompleteAsync(id, actorId, User.ToCreatorSnapshot(), ct));
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelStockTransferRequest request, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();
        var actorId = User.GetUserId();
        if (actorId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });
        return Ok(await _logic.CancelAsync(id, request, actorId, ct));
    }
}
