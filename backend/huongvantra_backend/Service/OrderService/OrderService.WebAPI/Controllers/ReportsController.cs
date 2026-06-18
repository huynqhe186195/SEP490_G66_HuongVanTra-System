using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.Interfaces;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController(IReportLogic reportLogic) : ControllerBase
{
    [HttpGet("sales-statistics")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetSalesStatistics(
        [FromQuery] int? quarter,
        [FromQuery] int? month,
        [FromQuery] int? year,
        CancellationToken ct)
    {
        var stats = await reportLogic.GetSalesStatisticsAsync(quarter, month, year, ct);
        return Ok(stats);
    }

    [HttpGet("top-products")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetTopSellingProducts(
        [FromQuery] int topCount = 5,
        [FromQuery] int? quarter = null,
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        CancellationToken ct = default)
    {
        var topProducts = await reportLogic.GetTopSellingProductsAsync(topCount, quarter, month, year, ct);
        return Ok(topProducts);
    }

    [HttpGet("sales-by-category")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetSalesByCategory(
        [FromQuery] int? quarter = null,
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        CancellationToken ct = default)
    {
        var categorySales = await reportLogic.GetSalesByCategoryAsync(quarter, month, year, ct);
        return Ok(categorySales);
    }

    [HttpGet("customer-growth")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetCustomerGrowthTimeSeries(
        [FromQuery] int? quarter = null,
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        CancellationToken ct = default)
    {
        var points = await reportLogic.GetCustomerGrowthTimeSeriesAsync(quarter, month, year, ct);
        return Ok(points);
    }

    [HttpGet("revenue-growth")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetRevenueTimeSeries(
        [FromQuery] int? quarter = null,
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        CancellationToken ct = default)
    {
        var points = await reportLogic.GetRevenueTimeSeriesAsync(quarter, month, year, ct);
        return Ok(points);
    }

    [HttpGet("sales-by-channel")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetSalesByChannel(
        [FromQuery] int? quarter = null,
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        CancellationToken ct = default)
    {
        var channelSales = await reportLogic.GetSalesByChannelAsync(quarter, month, year, ct);
        return Ok(channelSales);
    }

    [HttpGet("order-count-growth")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetOrderCountTimeSeries(
        [FromQuery] int? quarter = null,
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        CancellationToken ct = default)
    {
        var points = await reportLogic.GetOrderCountTimeSeriesAsync(quarter, month, year, ct);
        return Ok(points);
    }
}
