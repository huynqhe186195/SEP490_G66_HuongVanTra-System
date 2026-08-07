using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.Interfaces;
using OrderService.Domain.Enums;

namespace OrderService.WebAPI.Controllers;

/// <summary>
/// Báo cáo cuối ngày — phần bán hàng, thanh toán và hàng hóa thuộc OrderService.
/// Dữ liệu Kho/Kệ do InventoryService cung cấp qua API riêng; ở đây không truy vấn chéo database.
/// </summary>
[ApiController]
[Route("api/reports/end-of-day")]
[Authorize]
public class EndOfDayReportsController(IEndOfDayReportLogic logic) : ControllerBase
{
    /// <summary>Ngày làm việc của cửa hàng tính theo GMT+7, không theo múi giờ của máy chạy service.</summary>
    private const int VietnamOffsetHours = 7;

    private bool CanViewRevenue() =>
        User.HasClaim("permission", PermissionNames.ManageBusinessPolicy) ||
        User.HasClaim("permission", PermissionNames.ManageRole) ||
        User.HasClaim("permission", PermissionNames.ViewAllCustomers);

    [HttpGet("summary")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetSummary(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] Guid? employeeId,
        [FromQuery] Guid? customerId,
        [FromQuery] OrderChannel? channel,
        [FromQuery] PaymentMethod? paymentMethod,
        [FromQuery] SalesMode? salesMode,
        [FromQuery] OrderStatus? orderStatus,
        CancellationToken ct = default)
    {
        var scope = ResolveScope(date, fromDate, toDate, employeeId);
        if (scope.Error != null) return scope.Error;

        return Ok(await logic.GetSummaryAsync(new EndOfDayReportFilter
        {
            FromUtc = scope.FromUtc,
            ToUtc = scope.ToUtc,
            EmployeeId = scope.EmployeeId,
            CustomerId = customerId,
            Channel = channel,
            PaymentMethod = paymentMethod,
            SalesMode = salesMode,
            OrderStatus = orderStatus
        }, ct));
    }

    [HttpGet("sales")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetSales(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] Guid? employeeId,
        [FromQuery] Guid? customerId,
        [FromQuery] OrderChannel? channel,
        [FromQuery] PaymentMethod? paymentMethod,
        [FromQuery] SalesMode? salesMode,
        [FromQuery] OrderStatus? orderStatus,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var scope = ResolveScope(date, fromDate, toDate, employeeId);
        if (scope.Error != null) return scope.Error;

        return Ok(await logic.GetSalesAsync(new EndOfDayPagedFilter
        {
            FromUtc = scope.FromUtc,
            ToUtc = scope.ToUtc,
            EmployeeId = scope.EmployeeId,
            CustomerId = customerId,
            Channel = channel,
            PaymentMethod = paymentMethod,
            SalesMode = salesMode,
            OrderStatus = orderStatus,
            Page = page,
            PageSize = pageSize
        }, ct));
    }

    [HttpGet("payments")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetPayments(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] Guid? employeeId,
        [FromQuery] Guid? customerId,
        [FromQuery] OrderChannel? channel,
        [FromQuery] PaymentMethod? paymentMethod,
        [FromQuery] SalesMode? salesMode,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var scope = ResolveScope(date, fromDate, toDate, employeeId);
        if (scope.Error != null) return scope.Error;

        return Ok(await logic.GetPaymentsAsync(new EndOfDayPagedFilter
        {
            FromUtc = scope.FromUtc,
            ToUtc = scope.ToUtc,
            EmployeeId = scope.EmployeeId,
            CustomerId = customerId,
            Channel = channel,
            PaymentMethod = paymentMethod,
            SalesMode = salesMode,
            Page = page,
            PageSize = pageSize
        }, ct));
    }

    [HttpGet("products")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetProducts(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] Guid? employeeId,
        [FromQuery] Guid? customerId,
        [FromQuery] OrderChannel? channel,
        [FromQuery] SalesMode? salesMode,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var scope = ResolveScope(date, fromDate, toDate, employeeId);
        if (scope.Error != null) return scope.Error;

        return Ok(await logic.GetProductsAsync(new EndOfDayPagedFilter
        {
            FromUtc = scope.FromUtc,
            ToUtc = scope.ToUtc,
            EmployeeId = scope.EmployeeId,
            CustomerId = customerId,
            Channel = channel,
            SalesMode = salesMode,
            Page = page,
            PageSize = pageSize
        }, ct));
    }

    /// <summary>
    /// Ngoại lệ cần xử lý trước khi chốt sổ. Đếm và tổng tiền tính trên toàn kỳ ở backend để
    /// phân trang không làm số ngoại lệ báo thiếu.
    /// </summary>
    [HttpGet("exceptions")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetExceptions(
        [FromQuery] DateOnly? date,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] Guid? employeeId,
        [FromQuery] Guid? customerId,
        [FromQuery] OrderChannel? channel,
        [FromQuery] SalesMode? salesMode,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var scope = ResolveScope(date, fromDate, toDate, employeeId);
        if (scope.Error != null) return scope.Error;

        return Ok(await logic.GetExceptionsAsync(new EndOfDayPagedFilter
        {
            FromUtc = scope.FromUtc,
            ToUtc = scope.ToUtc,
            EmployeeId = scope.EmployeeId,
            CustomerId = customerId,
            Channel = channel,
            SalesMode = salesMode,
            Page = page,
            PageSize = pageSize
        }, ct));
    }

    /// <summary>
    /// Quy đổi ngày làm việc GMT+7 sang khoảng UTC và áp giới hạn phạm vi theo quyền.
    /// Người không có quyền xem doanh thu toàn cửa hàng chỉ thấy phần của chính mình.
    /// </summary>
    private (DateTime FromUtc, DateTime ToUtc, Guid? EmployeeId, IActionResult? Error) ResolveScope(
        DateOnly? date, DateOnly? fromDate, DateOnly? toDate, Guid? employeeId)
    {
        var start = fromDate ?? date ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(VietnamOffsetHours));
        var end = toDate ?? date ?? start;

        if (end < start)
            return (default, default, null, BadRequest(new { message = "Khoảng thời gian không hợp lệ." }));

        // 00:00:00 GMT+7 của ngày bắt đầu tới ngay trước 00:00:00 GMT+7 của ngày sau ngày kết thúc.
        var fromUtc = start.ToDateTime(TimeOnly.MinValue).AddHours(-VietnamOffsetHours);
        var toUtc = end.AddDays(1).ToDateTime(TimeOnly.MinValue).AddHours(-VietnamOffsetHours).AddTicks(-1);

        var effectiveEmployeeId = employeeId;
        if (!CanViewRevenue())
        {
            var selfId = User.GetUserId();
            if (selfId == Guid.Empty)
                return (default, default, null, Forbid());
            effectiveEmployeeId = selfId;
        }

        return (fromUtc, toUtc, effectiveEmployeeId, null);
    }
}
