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
    private static readonly StringComparer RoleCmp = StringComparer.OrdinalIgnoreCase;

    private bool HasRole(params string[] roles)
    {
        var userRoles = User.GetRoles().ToHashSet(RoleCmp);
        return roles.Any(r => userRoles.Contains(r));
    }

    private bool HasPermission(string permission) =>
        User.HasClaim("permission", permission);

    private bool IsWarehouseActor =>
        HasRole("Warehouse") && !HasRole("Manager", "Admin");

    private bool IsManagerActor =>
        HasRole("Manager") && !HasRole("Admin");

    private bool IsAdminActor => HasRole("Admin");

    private bool CanViewAllStocktakes =>
        IsWarehouseActor || IsManagerActor || IsAdminActor;

    private bool IsSaleActor =>
        !CanViewAllStocktakes
        && (HasRole("SalePos", "SaleCod", "Sale") || HasPermission(PermissionNames.CreateOrder));

    private bool CanCreateOrSubmitShelfAsSale(string? location) =>
        IsSaleActor
        && string.Equals(location?.Trim(), "Shelf", StringComparison.OrdinalIgnoreCase);

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
        if (!CanViewAllStocktakes && !IsSaleActor)
            return Forbid();

        // Sale chỉ xem phiếu mình tạo (kiểm kệ đầu ca).
        if (IsSaleActor)
            mine = true;

        Guid? createdBy = mine ? User.GetUserId() : null;
        if (mine && createdBy == Guid.Empty)
            return Unauthorized(new { message = "Khong xac dinh duoc nguoi dung." });

        var loc = IsWarehouseActor ? "Warehouse" : IsSaleActor ? "Shelf" : location;
        return Ok(await _logic.GetStocktakeRequestsAsync(status, loc, createdBy, search, page, pageSize, ct));
    }

    [HttpGet("reason-codes")]
    public IActionResult GetReasonCodes()
    {
        if (!CanViewAllStocktakes && !IsSaleActor)
            return Forbid();
        return Ok(InventoryLogic.GetStocktakeReasonCodes());
    }

    /// <summary>
    /// Trạng thái kiểm kê kệ đầu/cuối ngày (toàn cửa hàng — không giới hạn theo người tạo).
    /// </summary>
    [HttpGet("shelf-day-status")]
    public async Task<IActionResult> GetShelfDayStatus([FromQuery] DateTime? date, CancellationToken ct)
    {
        if (!CanViewAllStocktakes && !IsSaleActor)
            return Forbid();

        return Ok(await _logic.GetShelfDayStocktakeStatusAsync(date, ct));
    }

    /// <summary>Manager/Admin mở lại ngày bán — hủy marker kiểm kệ cuối ngày.</summary>
    [HttpPost("reopen-shelf-day")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> ReopenShelfDay(
        [FromBody] ReviewStocktakeRequest request,
        [FromQuery] DateTime? date,
        CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { message = "Khong xac dinh duoc nguoi dung." });

        return Ok(await _logic.ReopenShelfDayAsync(date, userId, User.ToCreatorSnapshot(), request, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        if (!CanViewAllStocktakes && !IsSaleActor)
            return Forbid();

        var item = await _logic.GetStocktakeRequestAsync(id, ct);
        if (item == null) return NotFound();

        if (IsWarehouseActor && !string.Equals(item.Location, "Warehouse", StringComparison.OrdinalIgnoreCase))
            return Forbid();

        if (IsSaleActor)
        {
            var userId = User.GetUserId();
            if (item.CreatedBy != userId || !string.Equals(item.Location, "Shelf", StringComparison.OrdinalIgnoreCase))
                return Forbid();
        }

        return Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateStocktakeRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { message = "Khong xac dinh duoc nguoi dung." });

        if (IsWarehouseActor)
        {
            if (!string.Equals(request.Location?.Trim(), "Warehouse", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Thủ kho chỉ được tạo phiếu kiểm kê vị trí Kho." });
        }
        else if (!CanCreateOrSubmitShelfAsSale(request.Location))
        {
            return Forbid();
        }

        if (IsSaleActor && !string.Equals(request.Location?.Trim(), "Shelf", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Nhân viên Sale chỉ được tạo phiếu kiểm kê vị trí Kệ Hàng." });
        }

        var created = await _logic.CreateStocktakeRequestAsync(request, userId, User.ToCreatorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { message = "Khong xac dinh duoc nguoi dung." });

        var existing = await _logic.GetStocktakeRequestAsync(id, ct);
        if (existing == null) return NotFound();

        if (IsWarehouseActor)
        {
            if (!string.Equals(existing.Location, "Warehouse", StringComparison.OrdinalIgnoreCase))
                return Forbid();
        }
        else
        {
            if (!CanCreateOrSubmitShelfAsSale(existing.Location) || existing.CreatedBy != userId)
                return Forbid();
        }

        return Ok(await _logic.SubmitStocktakeRequestAsync(id, userId, User.ToCreatorSnapshot(), ct));
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ReviewStocktakeRequest? request, CancellationToken ct)
    {
        if (!IsManagerActor) return Forbid();
        var result = await _logic.ApproveStocktakeRequestAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ReviewStocktakeRequest request, CancellationToken ct)
    {
        if (!IsManagerActor) return Forbid();
        var result = await _logic.RejectStocktakeRequestAsync(id, User.GetUserId(), User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] ReviewStocktakeRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId == Guid.Empty)
            return Unauthorized(new { message = "Khong xac dinh duoc nguoi dung." });

        var canEscalate = IsManagerActor || IsAdminActor;
        var existing = await _logic.GetStocktakeRequestAsync(id, ct);
        if (existing == null) return NotFound();

        if (IsWarehouseActor)
        {
            if (!string.Equals(existing.Location, "Warehouse", StringComparison.OrdinalIgnoreCase))
                return Forbid();
        }
        else if (!canEscalate)
        {
            if (!CanCreateOrSubmitShelfAsSale(existing.Location) || existing.CreatedBy != userId)
                return Forbid();
        }

        var result = await _logic.CancelStocktakeRequestAsync(
            id, userId, canEscalate, User.ToCreatorSnapshot(), request, ct);
        return Ok(result);
    }
}
