using HuongVanTra.Shared.Auth;
using InventoryService.Application.UseCases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/stock-export-slips")]
[Authorize]
public class StockExportSlipsController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] string? search = null)
    {
        var items = await _logic.GetStockExportSlipsAsync(search, ct);
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var item = await _logic.GetStockExportSlipAsync(id, ct);
        if (item == null) return NotFound();
        return Ok(item);
    }
}
