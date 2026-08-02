using InventoryService.Application.DTOs.Responses;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/reports/warehouse-daily")]
[Authorize(Roles = "Warehouse,Admin,Manager")]
public class WarehouseDailyReportController(
    WarehouseDailyReportLogic logic,
    WarehouseDailyReportSubmissionLogic submissionLogic) : ControllerBase
{
    /// <summary>
    /// Báo cáo cuối ngày thủ kho theo ngày lịch VN (UTC+7).
    /// Không truyền date → hôm nay VN.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] DateOnly? date,
        CancellationToken ct)
    {
        var report = await logic.GetAsync(date, ct);
        return Ok(report);
    }

    [HttpGet("submissions")]
    public async Task<IActionResult> GetSubmissions(
        [FromQuery] DateOnly? date,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await submissionLogic.GetPagedAsync(date, page, pageSize, ct));

    [HttpGet("submissions/{id:guid}")]
    public async Task<IActionResult> GetSubmission(Guid id, CancellationToken ct) =>
        Ok(await submissionLogic.GetByIdAsync(id, ct));

    [HttpPost("submissions")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> CreateSubmission(
        [FromBody] CreateWarehouseDailyReportSubmissionRequest? request,
        CancellationToken ct)
    {
        var created = await submissionLogic.CreateAsync(request, User.ToCreatorSnapshot(), ct);
        return CreatedAtAction(nameof(GetSubmission), new { id = created.Id }, created);
    }
}
