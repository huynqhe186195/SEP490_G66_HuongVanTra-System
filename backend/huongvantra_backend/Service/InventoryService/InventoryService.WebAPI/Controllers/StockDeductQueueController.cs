using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/stock-deduct-queue")]
[Authorize]
public class StockDeductQueueController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet("waiting")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> GetWaiting(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var result = await _logic.GetWaitingQueuesPagedAsync(status, search, page, pageSize, ct);
        return Ok(result);
    }

    [HttpGet("{queueId:guid}/preview")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> Preview(Guid queueId, CancellationToken ct)
    {
        var preview = await _logic.PreviewQueueAsync(queueId, ct);
        return Ok(preview);
    }

    [HttpPatch("{queueId:guid}/confirm")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Confirm(Guid queueId, CancellationToken ct)
    {
        if (User.IsInRole("Admin")) return Forbid();

        var result = await _logic.ConfirmQueueAsync(queueId, User.GetUserId(), User.ToCreatorSnapshot(), ct);
        return Ok(result);
    }

    [HttpPatch("{queueId:guid}/cancel")]
    [Authorize(Roles = "Manager,Admin")]
    public async Task<IActionResult> Cancel(Guid queueId, [FromBody] CancelStockDeductRequest? request, CancellationToken ct)
    {
        var result = await _logic.CancelQueueAsync(queueId, request, User.GetUserId(), User.ToCreatorSnapshot(), ct);
        return Ok(result);
    }

    /// <summary>
    /// POS-04 (truy vết giữ chỗ, chiều đơn → SKU): danh sách giữ chỗ của một đơn COD.
    /// Chỉ đọc — Warehouse, Manager và Admin tra được giữ chỗ của đơn đó.
    /// </summary>
    [HttpGet("reservations/by-order/{orderId:guid}")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> GetReservationsByOrder(Guid orderId, CancellationToken ct)
    {
        var result = await _logic.GetOrderCodReservationsAsync(orderId, ct);
        return Ok(result);
    }

    /// <summary>
    /// POS-04 (truy vết giữ chỗ, chiều SKU → đơn): các đơn đang giữ chỗ một SKU.
    /// </summary>
    [HttpGet("reservations/by-sku/{skuId:guid}")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> GetActiveReservationsBySku(Guid skuId, CancellationToken ct)
    {
        var result = await _logic.GetSkuCodReservationsAsync(skuId, ct);
        return Ok(result);
    }

    /// <summary>
    /// POS-04 (truy vết giữ chỗ): danh sách đơn đang giữ chỗ tồn Kệ Hàng.
    /// </summary>
    [HttpGet("reservations/active-orders")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> GetOrdersWithActiveReservation(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _logic.GetOrdersWithActiveReservationAsync(search, page, pageSize, ct);
        return Ok(result);
    }

    /// <summary>
    /// POS-04 (truy vết giữ chỗ): lọc tập OrderId truyền lên xuống còn các đơn đang giữ chỗ.
    /// Dùng cho badge trên danh sách đơn — OrderService gọi qua service client, không đọc chéo database.
    /// </summary>
    [HttpPost("reservations/active-order-ids")]
    [Authorize(Roles = "Warehouse,Manager,Admin")]
    public async Task<IActionResult> FilterOrderIdsWithActiveReservation(
        [FromBody] List<Guid>? orderIds,
        CancellationToken ct)
    {
        var result = await _logic.GetOrderIdsWithActiveReservationAsync(orderIds, ct);
        return Ok(result);
    }
}
