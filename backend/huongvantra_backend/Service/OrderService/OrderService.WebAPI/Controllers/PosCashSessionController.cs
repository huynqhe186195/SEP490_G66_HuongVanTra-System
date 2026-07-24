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
    public async Task<IActionResult> GetCurrent(CancellationToken ct)
    {
        var session = await posCashSessionLogic.GetCurrentAsync(ct);
        return Ok(new CurrentPosCashSessionResponse(session));
    }

    [HttpPost("open")]
    public async Task<IActionResult> Open([FromBody] OpenPosCashSessionRequest request, CancellationToken ct)
    {
        var (actorId, actorName) = Actor();
        var result = await posCashSessionLogic.OpenAsync(request, actorId, actorName, ct);
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
