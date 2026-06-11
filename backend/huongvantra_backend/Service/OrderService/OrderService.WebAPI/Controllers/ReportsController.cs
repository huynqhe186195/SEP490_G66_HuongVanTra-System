using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.Interfaces;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // Require authentication
public class ReportsController(IReportLogic reportLogic) : ControllerBase
{
    [HttpGet("sales-statistics")]
    [Authorize(Roles = "Admin,Accountant")] // Restrict to specific roles based on navigation.js
    public async Task<IActionResult> GetSalesStatistics(
        [FromQuery] int? month,
        [FromQuery] int? year,
        CancellationToken ct)
    {
        var stats = await reportLogic.GetSalesStatisticsAsync(month, year, ct);
        return Ok(stats);
    }

    [HttpGet("top-products")]
    public async Task<IActionResult> GetTopSellingProducts(
        [FromQuery] int topCount = 5,
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        CancellationToken ct = default)
    {
        var topProducts = await reportLogic.GetTopSellingProductsAsync(topCount, month, year, ct);
        return Ok(topProducts);
    }

    [HttpGet("sales-by-category")]
    public async Task<IActionResult> GetSalesByCategory(
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        CancellationToken ct = default)
    {
        var categorySales = await reportLogic.GetSalesByCategoryAsync(month, year, ct);
        return Ok(categorySales);
    }
}
