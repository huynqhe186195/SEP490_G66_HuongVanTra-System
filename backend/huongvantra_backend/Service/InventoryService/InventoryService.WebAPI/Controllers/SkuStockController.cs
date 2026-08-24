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
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await _logic.GetSkuStocksAsync(ct);
        return Ok(items);
    }

    [HttpGet("low-stock")]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetLowStock(CancellationToken ct)
    {
        var items = await _logic.GetLowStockSkusAsync(ct);
        return Ok(items);
    }

    [HttpPost("{skuId:guid}/adjust-warehouse")]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> AdjustWarehouse(Guid skuId, [FromBody] AdjustWarehouseStockRequest request, CancellationToken ct)
    {
        var result = await _logic.AdjustWarehouseStockAsync(skuId, request.QuantityDelta, null, ct);
        return Ok(result);
    }

    [HttpPost("{skuId:guid}/simulate-adjust-store")]
    [Authorize(Policy = PermissionNames.OperateWarehouse)]
    public async Task<IActionResult> SimulateAdjustStore(Guid skuId, [FromBody] AdjustSkuStockRequest request, CancellationToken ct)
    {
        var result = await _logic.SimulateAdjustStoreStockAsync(skuId, request.QuantityDelta, null, ct);
        return Ok(result);
    }

    [HttpPut("{skuId:guid}/warehouse-threshold")]
    [Authorize(Policy = PermissionNames.ManageWarehouseStockThresholdAccess)]
    public async Task<IActionResult> UpdateWarehouseThreshold(Guid skuId, [FromBody] UpdateWarehouseLowStockThresholdRequest request, CancellationToken ct)
    {
        var result = await _logic.UpdateWarehouseLowStockThresholdAsync(skuId, request, ct);
        return Ok(result);
    }
}
