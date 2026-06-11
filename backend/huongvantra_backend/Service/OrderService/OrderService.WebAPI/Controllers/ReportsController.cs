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
        var result = await reportLogic.GetSalesStatisticsAsync(month, year, ct);
        return Ok(result);
    }
}
