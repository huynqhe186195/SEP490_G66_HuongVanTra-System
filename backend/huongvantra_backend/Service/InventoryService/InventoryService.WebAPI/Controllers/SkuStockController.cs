using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/sku-stocks")]
[Authorize]
public class SkuStockController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await _logic.GetSkuStocksAsync(ct);
        return Ok(items);
    }

    [HttpPost("{skuId:guid}/adjust")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> Adjust(Guid skuId, [FromBody] AdjustSkuStockRequest request, CancellationToken ct)
    {
        var result = await _logic.AdjustSkuStockAsync(skuId, request.QuantityDelta, null, ct);
        return Ok(result);
    }
}
