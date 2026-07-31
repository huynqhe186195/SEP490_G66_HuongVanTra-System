using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

/// <summary>
/// Yêu cầu bổ sung Kệ Hàng. Ghi nhận nhu cầu bổ sung thành phẩm từ Kho lên Kệ.
/// Không tự thay đổi tồn kho; tồn chỉ thay đổi khi Phiếu điều chuyển Kho → Kệ hoàn tất.
/// Admin chỉ được xem/audit, bị chặn mọi thao tác ghi kể cả khi kiêm vai trò khác.
/// </summary>
[ApiController]
[Route("api/v1/inventory/stock-adjustment-requests")]
[Authorize]
public class StockAdjustmentRequestsController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Sale,Manager,Warehouse,Admin,Accountant")]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] string? status,
        [FromQuery] bool mine = false,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] Guid? createdBy = null,
        [FromQuery] string? creatorRole = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] bool onlyRemaining = false,
        [FromQuery] string? sort = null)
    {
        // Sale chỉ được xem yêu cầu do chính mình tạo.
        var saleOnly = User.IsInRole("Sale")
            && !User.IsInRole("Manager")
            && !User.IsInRole("Warehouse")
            && !User.IsInRole("Admin")
            && !User.IsInRole("Accountant");

        Guid? requestedBy;
        if (mine || saleOnly)
        {
            requestedBy = User.GetUserId();
            if (requestedBy == Guid.Empty)
                return Unauthorized(new { message = "Không xác định được người dùng." });
        }
        else
        {
            // Bộ lọc người tạo của màn hình audit; Guid rỗng coi như không lọc.
            requestedBy = createdBy == Guid.Empty ? null : createdBy;
        }

        var result = await _logic.GetStockAdjustmentRequestsPagedAsync(
            status,
            requestedBy,
            search,
            page,
            pageSize,
            ct,
            creatorRole,
            NormalizeFromDate(fromDate),
            NormalizeToDate(toDate),
            onlyRemaining,
            sort);
        return Ok(result);
    }

    /// <summary>Tùy chọn cho bộ lọc audit: người tạo và vai trò người tạo đã xuất hiện trong dữ liệu.</summary>
    [HttpGet("filter-options")]
    [Authorize(Roles = "Manager,Warehouse,Admin,Accountant")]
    public async Task<IActionResult> GetFilterOptions(CancellationToken ct) =>
        Ok(await _logic.GetStockAdjustmentRequestFilterOptionsAsync(ct));

    /// <summary>Ngày lọc gửi lên theo ngày địa phương; quy về mốc đầu ngày UTC để so sánh RequestedAt.</summary>
    private static DateTime? NormalizeFromDate(DateTime? value) =>
        value.HasValue ? DateTime.SpecifyKind(value.Value.Date, DateTimeKind.Utc) : null;

    /// <summary>Ngày kết thúc lấy trọn ngày: dùng mốc đầu ngày kế tiếp và so sánh nhỏ hơn.</summary>
    private static DateTime? NormalizeToDate(DateTime? value) =>
        value.HasValue ? DateTime.SpecifyKind(value.Value.Date.AddDays(1), DateTimeKind.Utc) : null;

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Sale,Manager,Warehouse,Admin,Accountant")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _logic.GetStockAdjustmentRequestAsync(id, ct);
        if (item == null) return NotFound();

        var saleOnly = User.IsInRole("Sale")
            && !User.IsInRole("Manager")
            && !User.IsInRole("Warehouse")
            && !User.IsInRole("Admin")
            && !User.IsInRole("Accountant");
        if (saleOnly && item.RequestedBy != User.GetUserId())
            return Forbid();

        return Ok(item);
    }

    /// <summary>Các Phiếu điều chuyển đã sinh ra từ yêu cầu này. Một yêu cầu có thể có nhiều phiếu.</summary>
    [HttpGet("{id:guid}/transfers")]
    [Authorize(Roles = "Sale,Manager,Warehouse,Admin,Accountant")]
    public async Task<IActionResult> GetTransfers(Guid id, CancellationToken ct) =>
        Ok(await _logic.GetStockAdjustmentRequestTransfersAsync(id, ct));

    [HttpPost]
    [Authorize(Roles = "Sale,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateStockAdjustmentRequest request, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();
        var requestedBy = User.GetUserId();
        if (requestedBy == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var created = await _logic.CreateStockAdjustmentRequestAsync(request, requestedBy, ct, User.ToCreatorSnapshot());
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    /// <summary>Warehouse duyệt/từ chối theo từng dòng. Không làm thay đổi tồn kho.</summary>
    [HttpPost("{id:guid}/review")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Review(
        Guid id,
        [FromBody] ReviewStockAdjustmentRequestLines? request,
        CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();
        var reviewedBy = User.GetUserId();
        if (reviewedBy == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng." });

        return Ok(await _logic.ReviewStockAdjustmentRequestAsync(id, reviewedBy, request, ct, User.ToCreatorSnapshot()));
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Reject(
        Guid id,
        [FromBody] RejectStockAdjustmentRequest request,
        CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();
        var reviewedBy = User.GetUserId();
        if (reviewedBy == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng." });

        return Ok(await _logic.RejectStockAdjustmentRequestAsync(id, reviewedBy, request, ct, User.ToCreatorSnapshot()));
    }

    /// <summary>Warehouse đóng phần còn lại khi không thể cấp thêm; bắt buộc có lý do.</summary>
    [HttpPost("{id:guid}/close-remaining")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> CloseRemaining(
        Guid id,
        [FromBody] CloseStockAdjustmentRemainingRequest? request,
        CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();
        var actorId = User.GetUserId();
        if (actorId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng." });

        return Ok(await _logic.CloseStockAdjustmentRemainingAsync(id, actorId, request, ct, User.ToCreatorSnapshot()));
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "Sale,Manager")]
    public async Task<IActionResult> Cancel(
        Guid id,
        [FromBody] CancelStockAdjustmentRequest? request,
        CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();
        var requestedBy = User.GetUserId();
        if (requestedBy == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng." });

        return Ok(await _logic.CancelStockAdjustmentRequestAsync(id, requestedBy, false, request, ct, User.ToCreatorSnapshot()));
    }
}
