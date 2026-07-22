using InventoryService.Application.UseCases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/statistics")]
[Authorize(Roles = "Warehouse,Admin,Manager,Accountant")]
public class StatisticsController(StatisticsLogic _logic) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetStatistics(CancellationToken ct)
    {
        var stats = await _logic.GetStatisticsAsync(ct);
        return Ok(stats);
    }
}
