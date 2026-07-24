using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.Interfaces;
using OrderService.Domain.Enums;

namespace OrderService.WebAPI.Controllers;

/// <summary>
/// G7 — API giám sát Transactional Outbox phục vụ trang quản trị đồng bộ tồn kho:
/// liệt kê, xem chi tiết payload, thống kê theo trạng thái và retry thủ công.
/// </summary>
[ApiController]
[Route("api/outbox-messages")]
[Authorize]
public class OutboxMessagesController(IOutboxMonitoringLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetPaged(
        [FromQuery] OutboxMessageStatus? status,
        [FromQuery] string? eventType,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _logic.GetPagedAsync(status, eventType, page, pageSize, ct);
        return Ok(result);
    }

    [HttpGet("stats")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetStats(CancellationToken ct)
    {
        var stats = await _logic.GetStatsAsync(ct);
        return Ok(stats);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var detail = await _logic.GetByIdAsync(id, ct);
        return detail is null ? NotFound() : Ok(detail);
    }

    [HttpPost("{id:guid}/retry")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> Retry(Guid id, CancellationToken ct)
    {
        var result = await _logic.RetryAsync(id, ct);
        return result.Status == "NotFound" ? NotFound(result) : Ok(result);
    }
}
