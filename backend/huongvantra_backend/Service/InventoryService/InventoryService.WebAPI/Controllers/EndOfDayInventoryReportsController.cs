using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

/// <summary>
/// Báo cáo cuối ngày — phần Kho/Kệ. Tách khỏi <c>reports/warehouse-daily</c> (báo cáo nộp của
/// Thủ kho) vì đối tượng xem khác nhau: ở đây là Admin/Manager/Thủ kho cùng đọc một tab trong
/// màn hình Báo cáo cuối ngày, nên chỉ yêu cầu VIEW_INVENTORY.
/// Ngày truyền vào là ngày lịch GMT+7; controller quy đổi sang [FromUtc, ToUtcExclusive).
/// </summary>
[ApiController]
[Route("api/v1/inventory/reports/end-of-day")]
[Authorize(Policy = PermissionNames.ViewInventory)]
public class EndOfDayInventoryReportsController(EndOfDayInventoryReportLogic logic) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] InventoryLocation? location,
        CancellationToken ct)
    {
        var (range, error) = ResolveRange(date, fromDate, toDate);
        if (error != null) return error;

        return Ok(await logic.GetSummaryAsync(new EndOfDayInventoryFilter
        {
            FromUtc = range.FromUtc,
            ToUtcExclusive = range.ToUtcExclusive,
            Location = location
        }, ct));
    }

    /// <summary>Hàng đợi trừ kho tạo trong kỳ. Chỉ endpoint này nhận queueStatus.</summary>
    [HttpGet("queues")]
    public async Task<IActionResult> GetQueues(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] QueueStatus? queueStatus,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var (range, error) = ResolveRange(date, fromDate, toDate);
        if (error != null) return error;

        return Ok(await logic.GetQueuesAsync(new EndOfDayInventoryPagedFilter
        {
            FromUtc = range.FromUtc,
            ToUtcExclusive = range.ToUtcExclusive,
            QueueStatus = queueStatus,
            Page = page,
            PageSize = pageSize
        }, ct));
    }

    [HttpGet("transfers")]
    public async Task<IActionResult> GetTransfers(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] InventoryLocation? location,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var (range, error) = ResolveRange(date, fromDate, toDate);
        if (error != null) return error;

        return Ok(await logic.GetTransfersAsync(new EndOfDayInventoryPagedFilter
        {
            FromUtc = range.FromUtc,
            ToUtcExclusive = range.ToUtcExclusive,
            Location = location,
            Page = page,
            PageSize = pageSize
        }, ct));
    }

    /// <summary>
    /// Hàng đặt làm theo yêu cầu — lấy từ lệnh sản xuất hoàn tất trong kỳ (kịch bản POS-06 số 3).
    /// Không nhận location vì sản xuất luôn diễn ra ở Kho.
    /// </summary>
    [HttpGet("custom-orders")]
    public async Task<IActionResult> GetCustomOrders(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var (range, error) = ResolveRange(date, fromDate, toDate);
        if (error != null) return error;

        return Ok(await logic.GetCustomOrdersAsync(new EndOfDayInventoryPagedFilter
        {
            FromUtc = range.FromUtc,
            ToUtcExclusive = range.ToUtcExclusive,
            Page = page,
            PageSize = pageSize
        }, ct));
    }

    /// <summary>
    /// Quy đổi ngày lịch VN sang khoảng UTC nửa mở. Không truyền gì → hôm nay theo giờ VN.
    /// Khoảng nhiều ngày dùng chung mốc: 00:00 GMT+7 ngày bắt đầu tới 00:00 GMT+7 của ngày sau
    /// ngày kết thúc.
    /// </summary>
    private ((DateTime FromUtc, DateTime ToUtcExclusive) Range, IActionResult? Error) ResolveRange(
        DateOnly? date, DateOnly? fromDate, DateOnly? toDate)
    {
        var start = fromDate ?? date ?? WarehouseDailyReportLogic.VietnamToday();
        var end = toDate ?? date ?? start;

        if (end < start)
            return (default, BadRequest(new { message = "Khoảng thời gian không hợp lệ." }));

        var from = WarehouseDailyReportLogic.ToUtcDayRange(start).FromUtc;
        var to = WarehouseDailyReportLogic.ToUtcDayRange(end).ToUtcExclusive;
        return ((from, to), null);
    }
}
