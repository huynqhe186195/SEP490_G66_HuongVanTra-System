using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application.DTOs.Requests;
using ProductService.Infrastructure.UseCases;
using ProductService.WebAPI.Extensions;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/notifications")]
[Authorize]
public class NotificationsController(NotificationLogic _logic) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetPaged(
        [FromQuery] bool unreadOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await _logic.GetPagedAsync(
            new GetNotificationsRequest(unreadOnly, page, pageSize),
            User.ToProductApprovalActorSnapshot(),
            ct));

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct = default) =>
        Ok(await _logic.GetSummaryAsync(User.ToProductApprovalActorSnapshot(), ct));

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct = default) =>
        Ok(await _logic.MarkReadAsync(id, User.ToProductApprovalActorSnapshot(), ct));

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct = default) =>
        Ok(await _logic.MarkAllReadAsync(User.ToProductApprovalActorSnapshot(), ct));
}
