using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

/// <summary>
/// Endpoint số lượng tồn quầy — mọi role có VIEW_ORDER trừ Thủ kho (dùng /api/v1/inventory/sku-stocks).
/// Không trả thông tin kho tổng (WarehouseQuantityOnHand).
/// </summary>
[ApiController]
[Route("api/v1/store/sku-stocks")]
[Authorize(Policy = PermissionNames.ViewOrder)]
public class StoreSkuStockController(InventoryLogic _logic) : ControllerBase
{
    private bool IsWarehouse => User.IsInRole("Warehouse");

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        if (IsWarehouse) return Forbid();
        var items = await _logic.GetStoreSkuStocksAsync(ct);
        return Ok(items);
    }

    [HttpGet("low-stock")]
    public async Task<IActionResult> GetLowStock(CancellationToken ct)
    {
        if (IsWarehouse) return Forbid();
        var stocks = await _logic.GetStoreSkuStocksAsync(ct);
        var lowStock = stocks.Where(s =>
            s.ShelfLowStockThreshold > 0
            && s.AvailableQuantity <= s.ShelfLowStockThreshold).ToList();
        return Ok(lowStock);
    }

    /// <summary>Ngưỡng cảnh báo tồn Kệ Hàng do Quản lý đặt; ngưỡng Kho thuộc Thủ kho, đi qua endpoint khác.</summary>
    [HttpPut("{skuId:guid}/threshold")]
    [Authorize(Policy = PermissionNames.ManageShelfStockThresholdAccess)]
    public async Task<IActionResult> UpdateShelfThreshold(Guid skuId, [FromBody] UpdateShelfLowStockThresholdRequest request, CancellationToken ct)
    {
        var result = await _logic.UpdateShelfLowStockThresholdAsync(skuId, request, ct);
        return Ok(result);
    }
}
