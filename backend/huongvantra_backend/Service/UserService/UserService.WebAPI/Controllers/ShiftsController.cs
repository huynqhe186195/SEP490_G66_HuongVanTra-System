using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    [HttpGet("week")]
    public async Task<IActionResult> GetWeek([FromQuery] string weekStart, [FromQuery] string? area)
    {
        var result = await shiftLogic.GetWeekAsync(weekStart, area, ActorPermissions, CurrentUserId);
        return Ok(result);
    }

    [HttpPost("slots/{slotId:guid}/register")]
    public async Task<IActionResult> Register(Guid slotId)
    {
        var result = await shiftLogic.RegisterAsync(slotId, CurrentUserId);
        return Ok(result);
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
