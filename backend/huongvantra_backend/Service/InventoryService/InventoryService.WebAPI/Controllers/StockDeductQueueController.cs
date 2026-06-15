using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/stock-deduct-queue")]
[Authorize]
public class StockDeductQueueController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet("waiting")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetWaiting(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        _ = status;
        var result = await _logic.GetWaitingQueuesPagedAsync(search, page, pageSize, ct);
        return Ok(result);
    }

    [HttpGet("{queueId:guid}/preview")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> Preview(Guid queueId, CancellationToken ct)
    {
        var preview = await _logic.PreviewQueueAsync(queueId, ct);
        return Ok(preview);
    }

    [HttpPatch("{queueId:guid}/confirm")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> Confirm(Guid queueId, CancellationToken ct)
    {
        var result = await _logic.ConfirmQueueAsync(queueId, ct);
        return Ok(result);
    }

    [HttpPatch("{queueId:guid}/cancel")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> Cancel(Guid queueId, [FromBody] CancelStockDeductRequest? request, CancellationToken ct)
    {
        _ = request;
        var result = await _logic.CancelQueueAsync(queueId, ct);
        return Ok(result);
    }
}
