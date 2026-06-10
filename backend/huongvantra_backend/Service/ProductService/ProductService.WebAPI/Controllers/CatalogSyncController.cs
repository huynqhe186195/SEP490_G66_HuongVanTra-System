using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application;
using ProductService.Application.UseCases;
using ProductService.WebAPI.Extensions;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/catalog")]
[Authorize(Policy = PermissionNames.ViewOrder)]
public class CatalogSyncController(CatalogSyncLogic _syncLogic) : ControllerBase
{
    [HttpGet("sync/pending")]
    public async Task<IActionResult> GetPending(CancellationToken ct)
    {
        if (User.GetCatalogViewScope() == CatalogViewScope.Warehouse)
            return Ok(new { categories = 0, products = 0, skus = 0 });

        var pending = await _syncLogic.GetPendingAsync(ct);
        return Ok(new
        {
            categories = pending.Categories,
            products = pending.Products,
            skus = pending.Skus,
            total = pending.Categories + pending.Products + pending.Skus,
        });
    }

    [HttpPost("sync")]
    public async Task<IActionResult> Sync(CancellationToken ct)
    {
        CatalogSyncLogic.EnsureNotWarehouseSource(User.GetCatalogViewScope() == CatalogViewScope.Warehouse);
        var result = await _syncLogic.SyncToStoreAsync(ct);
        return Ok(new
        {
            categoriesSynced = result.CategoriesSynced,
            productsSynced = result.ProductsSynced,
            skusSynced = result.SkusSynced,
            syncedAt = result.SyncedAt,
        });
    }
}
