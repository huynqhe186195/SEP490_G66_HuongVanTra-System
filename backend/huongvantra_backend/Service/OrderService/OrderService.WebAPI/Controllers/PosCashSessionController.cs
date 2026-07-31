using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.UseCases;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Route("api/pos/cash-sessions")]
[Authorize(Policy = PermissionNames.CreateOrder)]
public class PosCashSessionController(PosCashSessionLogic posCashSessionLogic) : ControllerBase
{
    private (Guid ActorId, string? ActorName) Actor() =>
    (
        User.GetUserId(),
        string.IsNullOrWhiteSpace(User.GetUsername()) ? null : User.GetUsername()
    );

    private bool CanBypassShiftRequirement() =>
        User.HasPermission(PermissionNames.ManageEmployee)
        || User.HasPermission(PermissionNames.ManageRole);

    [HttpGet("current")]
    public async Task<IActionResult> GetCurrent(CancellationToken ct) =>
        Ok(await posCashSessionLogic.GetCurrentAsync(ct));

    /// <summary>Lịch sử ca quỹ — Manager / Admin / Accountant.</summary>
    [HttpGet]
    [Authorize(Roles = "Manager,Admin,Accountant")]
    public async Task<IActionResult> GetHistory(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        // `to` là ngày VN inclusive → chuyển thành mốc UTC exclusive (+1 ngày VN).
        DateTime? fromUtc = from?.Date;
        DateTime? toExclusive = to.HasValue ? to.Value.Date.AddDays(1) : null;
        if (fromUtc.HasValue)
            fromUtc = DateTime.SpecifyKind(fromUtc.Value.AddHours(-7), DateTimeKind.Utc);
        if (toExclusive.HasValue)
            toExclusive = DateTime.SpecifyKind(toExclusive.Value.AddHours(-7), DateTimeKind.Utc);

        var result = await posCashSessionLogic.GetHistoryAsync(
            fromUtc, toExclusive, status, search, page, pageSize, ct);
        return Ok(result);
    }

    [HttpPost("open")]
    public async Task<IActionResult> Open([FromBody] OpenPosCashSessionRequest request, CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        var result = await posCashSessionLogic.OpenAsync(
            request, actorId, actorName, CanBypassShiftRequirement(), ct);
        return Ok(result);
    }

    [HttpPost("current/close")]
    public async Task<IActionResult> Close([FromBody] ClosePosCashSessionRequest request, CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        var result = await posCashSessionLogic.CloseAsync(
            request, actorId, actorName, CanBypassShiftRequirement(), ct);
        return Ok(result);
    }
}
