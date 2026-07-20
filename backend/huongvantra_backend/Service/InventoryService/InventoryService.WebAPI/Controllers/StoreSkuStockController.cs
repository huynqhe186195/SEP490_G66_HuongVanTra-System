using InventoryService.Application.UseCases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

/// <summary>
/// Endpoint số lượng tồn quầy dành riêng cho Admin và Manager.
/// Không trả thông tin kho tổng (WarehouseQuantityOnHand).
/// </summary>
[ApiController]
[Route("api/v1/store/sku-stocks")]
[Authorize(Roles = "Admin,Manager,Sale")]
public class StoreSkuStockController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await _logic.GetStoreSkuStocksAsync(ct);
        return Ok(items);
    }

    [HttpGet("low-stock")]
    public async Task<IActionResult> GetLowStock(CancellationToken ct)
    {
        var stocks = await _logic.GetStoreSkuStocksAsync(ct);
        var lowStock = stocks.Where(s => s.QuantityOnHand <= s.ShelfLowStockThreshold).ToList();
        return Ok(lowStock);
    }
}
