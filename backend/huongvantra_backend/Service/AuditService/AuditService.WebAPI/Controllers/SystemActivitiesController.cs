using AuditService.Application.DTOs;
using AuditService.Infrastructure.UseCases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuditService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/audit/system-activities")]
[Authorize(Roles = "Admin")]
public class SystemActivitiesController(SystemActivityLogic logic) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetPaged(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] string? actor,
        [FromQuery] string? role,
        [FromQuery] string? serviceName,
        [FromQuery] string? module,
        [FromQuery] string? action,
        [FromQuery] string? result,
        [FromQuery] string? entityCode,
        [FromQuery] string? correlationId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        return Ok(await logic.GetPagedAsync(
            new SystemActivityLogQuery(
                fromUtc,
                toUtc,
                actor,
                role,
                serviceName,
                module,
                action,
                result,
                entityCode,
                correlationId,
                page,
                pageSize),
            ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
    {
        var item = await logic.GetByIdAsync(id, ct);
        return item is null ? NotFound() : Ok(item);
    }
}
