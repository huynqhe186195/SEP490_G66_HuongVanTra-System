using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/supplier-receipts")]
[Authorize]
public class SupplierReceiptsController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Manager,Admin,Accountant,Warehouse")]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] string? status = null,
        [FromQuery] bool mine = false,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var userId = User.GetUserId();
        Guid? createdBy = mine ? userId : null;
        if (mine && userId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng." });

        return Ok(await _logic.GetSupplierReceiptsAsync(status, createdBy, search, page, pageSize, ct));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Manager,Admin,Accountant,Warehouse")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _logic.GetSupplierReceiptAsync(id, ct);
        if (item == null) return NotFound();
        return Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Create([FromBody] UpsertSupplierReceiptRequest request, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();

        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });

        var created = await _logic.CreateSupplierReceiptAsync(request, userId, User.ToCreatorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertSupplierReceiptRequest request, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();

        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });

        return Ok(await _logic.UpdateSupplierReceiptAsync(id, request, userId, ct));
    }

    [HttpPost("{id:guid}/submit")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();

        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });

        return Ok(await _logic.SubmitSupplierReceiptAsync(id, userId, ct));
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();

        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });

        return Ok(await _logic.ApproveSupplierReceiptAsync(id, userId, User.ToCreatorSnapshot(), ct));
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ReviewSupplierReceiptRequest request, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();

        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });

        return Ok(await _logic.RejectSupplierReceiptAsync(id, userId, User.ToCreatorSnapshot(), request, ct));
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] ReviewSupplierReceiptRequest request, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();

        var userId = User.GetUserId();
        if (userId == Guid.Empty) return Unauthorized(new { message = "Không xác định được người dùng." });

        return Ok(await _logic.CancelSupplierReceiptAsync(id, userId, false, User.ToCreatorSnapshot(), request, ct));
    }

    [HttpGet("template")]
    [AllowAnonymous]
    public IActionResult Template()
    {
        const string csv = "SkuCode,SupplierLotCode,DocumentQuantity,ActualQuantity,UnitCost,ManufactureDate,ExpiryDate,Note\r\n"
            + "RM-TRA-NHAI-G,NCC-TRA-001,10,10,125000,2026-07-01,2027-07-01,Dat\r\n";
        return File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", "supplier-receipt-template.csv");
    }
}
