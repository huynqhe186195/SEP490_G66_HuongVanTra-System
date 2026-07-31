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
    private bool CanViewRevenue()
    {
        return User.HasClaim("permission", PermissionNames.ManageBusinessPolicy) ||
               User.HasClaim("permission", PermissionNames.ManageRole) ||
               User.HasClaim("permission", PermissionNames.ViewAllCustomers);
    }

    [HttpGet("sales-statistics")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetSalesStatistics(
        [FromQuery] int? quarter,
        [FromQuery] int? month,
        [FromQuery] int? year,
        CancellationToken ct)
    {
        var stats = await reportLogic.GetSalesStatisticsAsync(quarter, month, year, ct);
        if (!CanViewRevenue())
        {
            stats.GrossRevenue = 0;
            stats.NetRevenue = 0;
            stats.TotalCostOfGoods = 0;
            stats.GrossProfit = 0;
            stats.GrossProfitMargin = 0;
            stats.AverageOrderValue = 0;
            stats.TotalDiscountAmount = 0;
            stats.PrevGrossRevenue = 0;
            stats.GrossRevenueGrowthRate = 0;
            stats.PrevNetRevenue = 0;
            stats.NetRevenueGrowthRate = 0;
            stats.PrevGrossProfit = 0;
            stats.GrossProfitGrowthRate = 0;
            stats.PrevAverageOrderValue = 0;
            stats.AverageOrderValueGrowthRate = 0;
            stats.PrevTotalDiscountAmount = 0;
            stats.TotalDiscountGrowthRate = 0;
            stats.RefundAmount = 0;
        }
        return Ok(stats);
    }

    [HttpGet("top-products")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetTopSellingProducts(
        [FromQuery] int topCount = 5,
        [FromQuery] string sortBy = "revenue",
        [FromQuery] int? quarter = null,
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        CancellationToken ct = default)
    {
        var topProducts = await reportLogic.GetTopSellingProductsAsync(topCount, sortBy, quarter, month, year, ct);
        if (!CanViewRevenue())
        {
            foreach(var item in topProducts)
            {
                item.TotalRevenue = 0;
                item.TotalCostPrice = 0;
                item.GrossProfit = 0;
                item.GrossProfitMargin = 0;
            }
        }
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
        if (!CanViewRevenue())
        {
            foreach(var item in categorySales)
            {
                item.TotalRevenue = 0;
                item.TotalCostPrice = 0;
                item.GrossProfit = 0;
                item.GrossProfitMargin = 0;
            }
        }
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

    [HttpGet("revenue-profit-growth")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetRevenueProfitTimeSeries(
        [FromQuery] int? quarter = null,
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        CancellationToken ct = default)
    {
        var points = await reportLogic.GetRevenueProfitTimeSeriesAsync(quarter, month, year, ct);
        if (!CanViewRevenue())
        {
            foreach (var point in points)
            {
                point.GrossRevenue = 0;
                point.NetRevenue = 0;
                point.GrossProfit = 0;
            }
        }
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
