using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using InventoryService.Application.UseCases;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/ledger")]
[Authorize(Roles = "Admin,Warehouse,Manager,Accountant")]
public class InventoryLedgerController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] string? search = null,
        [FromQuery] Guid? skuId = null,
        [FromQuery] string? location = null,
        [FromQuery] string? transactionType = null,
        [FromQuery] string? referenceCode = null,
        [FromQuery] Guid? actorId = null,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        return Ok(await _logic.GetInventoryLedgerAsync(
            search,
            skuId,
            location,
            transactionType,
            referenceCode,
            actorId,
            fromUtc,
            toUtc,
            page,
            pageSize,
            ct));
    }
}
