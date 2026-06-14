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
}
