using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Domain.Constants;
using UserService.WebAPI.Extensions;

namespace UserService.WebAPI.Controllers;

[ApiController]
[Route("api/shifts")]
[Authorize]
public class ShiftsController(ShiftLogic shiftLogic) : ControllerBase
{
    private IReadOnlyList<string> ActorPermissions => User.GetPermissions().ToList();

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet("templates")]
    public async Task<IActionResult> GetTemplates([FromQuery] string? area)
    {
        var result = await shiftLogic.GetTemplatesAsync(area, ActorPermissions, CurrentUserId);
        return Ok(result);
    }

    /// <summary>Ca đã duyệt đang trong giờ của user hiện tại (null nếu chưa đến ca / chưa được duyệt).</summary>
    [HttpGet("me/on-duty")]
    public async Task<IActionResult> GetOnDuty([FromQuery] string? area, [FromQuery] int graceMinutes = 30)
    {
        var result = await shiftLogic.GetOnDutyAsync(CurrentUserId, area, graceMinutes);
        return Ok(new { onDuty = result });
    }

    /// <summary>Trạng thái đăng ký ca tuần hiện tại — dùng để chặn app nếu Sale chưa có ca duyệt tuần này.</summary>
    [HttpGet("me/week-status")]
    public async Task<IActionResult> GetMyWeekStatus()
    {
        var result = await shiftLogic.GetMyWeekStatusAsync(CurrentUserId);
        return Ok(result);
    }

    [HttpGet("week")]
    public async Task<IActionResult> GetWeek([FromQuery] string weekStart, [FromQuery] string? area)
    {
        var result = await shiftLogic.GetWeekAsync(weekStart, area, ActorPermissions, CurrentUserId);
        return Ok(result);
    }

    [HttpGet("registration-windows")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> GetRegistrationWindow([FromQuery] string weekStart)
    {
        var result = await shiftLogic.GetRegistrationWindowAsync(weekStart);
        return Ok(result);
    }

    /// <summary>Manager mở hoặc cập nhật cửa sổ đăng ký ca cho một tuần (kèm thời hạn).</summary>
    [HttpPut("registration-windows")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> UpsertRegistrationWindow([FromBody] UpsertShiftRegistrationWindowRequest request)
    {
        var result = await shiftLogic.UpsertRegistrationWindowAsync(request, CurrentUserId);
        return Ok(result);
    }

    [HttpPost("registration-windows/{id:guid}/close")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> CloseRegistrationWindow(Guid id)
    {
        var result = await shiftLogic.CloseRegistrationWindowAsync(id, CurrentUserId);
        return Ok(result);
    }

    [HttpPost("registration-windows/{id:guid}/reopen")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> ReopenRegistrationWindow(Guid id)
    {
        var result = await shiftLogic.ReopenRegistrationWindowAsync(id, CurrentUserId);
        return Ok(result);
    }

    [HttpPost("slots/{slotId:guid}/register")]
    public async Task<IActionResult> Register(Guid slotId)
    {
        var result = await shiftLogic.RegisterAsync(slotId, CurrentUserId);
        return Ok(result);
    }

    /// <summary>Danh sách nhân viên Sale khả dụng để chỉ định vào ca — dùng cho dropdown ở trang Phân ca.</summary>
    [HttpGet("assignable-staff")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> GetAssignableStaff()
    {
        var result = await shiftLogic.GetAssignableSalesStaffAsync();
        return Ok(result);
    }

    /// <summary>Manager chỉ định trực tiếp một Sale vào ca — được duyệt (Approved) ngay lập tức.</summary>
    [HttpPost("slots/{slotId:guid}/assign")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> Assign(Guid slotId, [FromBody] AssignShiftRequest request)
    {
        var result = await shiftLogic.AssignAsync(slotId, request.UserId, CurrentUserId, ActorPermissions);
        return Ok(result);
    }

    /// <summary>Manager gỡ nhân viên khỏi ca (Pending / Approved).</summary>
    [HttpPost("registrations/{id:guid}/unassign")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> Unassign(Guid id)
    {
        await shiftLogic.UnassignAsync(id, CurrentUserId);
        return NoContent();
    }

    [HttpPost("registrations/{id:guid}/approve")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> Approve(Guid id)
    {
        await shiftLogic.ApproveAsync(id, CurrentUserId);
        return NoContent();
    }

    [HttpPost("registrations/{id:guid}/reject")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> Reject(Guid id)
    {
        await shiftLogic.RejectAsync(id, CurrentUserId);
        return NoContent();
    }
}
