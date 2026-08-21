using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

/// <summary>
/// Yêu cầu bổ sung Kệ Hàng. Ghi nhận nhu cầu bổ sung thành phẩm từ Kho lên Kệ.
/// Nhân viên kho xử lý trọn từng sản phẩm; tồn Kho → Kệ chỉ cập nhật khi Warehouse xác nhận đã chuyển thực tế.
/// Admin chỉ được xem/audit, bị chặn mọi thao tác ghi kể cả khi kiêm vai trò khác.
/// </summary>
[ApiController]
[Route("api/v1/inventory/stock-adjustment-requests")]
[Authorize]
public class StockAdjustmentRequestsController(
    InventoryLogic _logic,
    ShelfReplenishmentWorkflowLogic _workflow) : ControllerBase
{
    private bool IsSaleRole() =>
        User.IsInRole("Sale") || User.IsInRole("SalePos");

    /// <summary>Sale quầy thuần chỉ được xem yêu cầu do chính mình tạo. Sale COD không dùng YC bổ sung.</summary>
    private bool IsSaleOnly() =>
        IsSaleRole()
        && !User.IsInRole("Manager")
        && !User.IsInRole("Warehouse")
        && !User.IsInRole("Admin")
        && !User.IsInRole("Accountant");

    private bool IsSaleCodOnly() =>
        User.IsInRole("SaleCod")
        && !User.IsInRole("SalePos")
        && !User.IsInRole("Sale")
        && !User.IsInRole("Manager")
        && !User.IsInRole("Warehouse")
        && !User.IsInRole("Admin");

    [HttpGet]
    [Authorize(Policy = PermissionNames.StockAdjustmentReadAccess)]
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
        if (IsSaleCodOnly())
            return Forbid();

        var saleOnly = IsSaleOnly();

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
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetFilterOptions(CancellationToken ct) =>
        Ok(await _logic.GetStockAdjustmentRequestFilterOptionsAsync(ct));

    /// <summary>Ngày lọc gửi lên theo ngày địa phương; quy về mốc đầu ngày UTC để so sánh RequestedAt.</summary>
    private static DateTime? NormalizeFromDate(DateTime? value) =>
        value.HasValue ? DateTime.SpecifyKind(value.Value.Date, DateTimeKind.Utc) : null;

    /// <summary>Ngày kết thúc lấy trọn ngày: dùng mốc đầu ngày kế tiếp và so sánh nhỏ hơn.</summary>
    private static DateTime? NormalizeToDate(DateTime? value) =>
        value.HasValue ? DateTime.SpecifyKind(value.Value.Date.AddDays(1), DateTimeKind.Utc) : null;

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.StockAdjustmentReadAccess)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        if (IsSaleCodOnly())
            return Forbid();

        var item = await _logic.GetStockAdjustmentRequestAsync(id, ct);
        if (item == null) return NotFound();

        if (IsSaleOnly() && item.RequestedBy != User.GetUserId())
            return Forbid();

        return Ok(item);
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.StockAdjustmentCreateAccess)]
    public async Task<IActionResult> Create([FromBody] CreateStockAdjustmentRequest request, CancellationToken ct)
    {
        if (User.IsInRole("Admin")
            || User.IsInRole("Warehouse")
            || !User.HasPermission(PermissionNames.ManageEmployee))
            return Forbid();
        var requestedBy = User.GetUserId();
        if (requestedBy == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được người dùng." });

        var created = await _logic.CreateStockAdjustmentRequestAsync(request, requestedBy, ct, User.ToCreatorSnapshot());
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    /// <summary>
    /// Kiểm tra trước các SKU sắp gửi có trùng yêu cầu nào chưa xử lý xong không.
    /// Không tạo dữ liệu; dùng để màn hình tạo yêu cầu chặn sớm trước bước xác nhận.
    /// </summary>
    [HttpPost("check-duplicates")]
    [Authorize(Policy = PermissionNames.StockAdjustmentCreateAccess)]
    public async Task<IActionResult> CheckDuplicates(
        [FromBody] CheckStockAdjustmentDuplicatesRequest request,
        CancellationToken ct)
    {
        if (User.IsInRole("Admin")
            || User.IsInRole("Warehouse")
            || !User.HasPermission(PermissionNames.ManageEmployee))
            return Forbid();

        return Ok(await _logic.CheckStockAdjustmentDuplicatesAsync(request.SkuIds ?? [], ct));
    }

    /// <summary>
    /// Nhân viên kho xử lý trọn một sản phẩm trong yêu cầu. Nếu đủ Thành phẩm, hệ thống
    /// chuẩn bị Phiếu điều chuyển nội bộ nhưng chưa thay đổi tồn; nếu đủ Nguyên liệu/Bao bì, hệ thống chỉ trả kết quả kiểm tra để Warehouse xác nhận tạo Lệnh sản xuất;
    /// nếu thiếu Nguyên liệu/Bao bì, dòng sản phẩm bị từ chối.
    /// </summary>
    [HttpPost("{id:guid}/items/{itemId:guid}/process")]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> ProcessItem(Guid id, Guid itemId, CancellationToken ct)
    {
        if (User.IsInRole("Admin") || !User.IsInRole("Warehouse")) return Forbid();
        var actorId = User.GetUserId();
        if (actorId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được Nhân viên kho." });

        return Ok(await _workflow.ProcessItemAsync(id, itemId, actorId, User.ToCreatorSnapshot(), ct));
    }

    [HttpPost("{id:guid}/items/{itemId:guid}/confirm-production")]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> ConfirmProduction(Guid id, Guid itemId, CancellationToken ct)
    {
        if (User.IsInRole("Admin") || !User.IsInRole("Warehouse")) return Forbid();
        var actorId = User.GetUserId();
        if (actorId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được Nhân viên kho." });

        return Ok(await _workflow.ConfirmProductionAsync(id, itemId, actorId, User.ToCreatorSnapshot(), ct));
    }

    /// <summary>Nhân viên kho xác nhận đã chuyển đủ hàng thực tế lên Kệ Hàng.</summary>
    [HttpPost("{id:guid}/items/{itemId:guid}/confirm-transfer")]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> ConfirmTransfer(Guid id, Guid itemId, CancellationToken ct)
    {
        if (User.IsInRole("Admin") || !User.IsInRole("Warehouse")) return Forbid();
        var actorId = User.GetUserId();
        if (actorId == Guid.Empty)
            return Unauthorized(new { message = "Không xác định được Nhân viên kho." });

        return Ok(await _workflow.ConfirmTransferAsync(id, itemId, actorId, User.ToCreatorSnapshot(), ct));
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = PermissionNames.StockAdjustmentCreateAccess)]
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
