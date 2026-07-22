using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application;
using ProductService.Application.DTOs.Requests;
using ProductService.Infrastructure.UseCases;

namespace ProductService.WebAPI.Controllers;

/// <summary>
/// Endpoint SKU catalog cửa hàng — mọi role có VIEW_ORDER trừ Thủ kho.
/// Luôn trả catalog cửa hàng (SKU đã đồng bộ), không expose master catalog kho.
/// </summary>
[ApiController]
[Route("api/v1/store/skus")]
[Authorize(Policy = PermissionNames.ViewOrder)]
public class StoreProductSkusController(ProductSkuLogic _skuLogic) : ControllerBase
{
    private bool IsWarehouse => User.IsInRole("Warehouse");

    [HttpGet]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] Guid? productId,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (IsWarehouse) return Forbid();
        return Ok(await _skuLogic.GetPagedAsync(
            new GetProductSkusRequest(search, productId, isActive, page, pageSize),
            CatalogViewScope.Store));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        if (IsWarehouse) return Forbid();
        return Ok(await _skuLogic.GetByIdAsync(id, CatalogViewScope.Store));
    }

    [HttpGet("by-code/{skuCode}")]
    public async Task<IActionResult> GetBySkuCode(string skuCode)
    {
        if (IsWarehouse) return Forbid();
        return Ok(await _skuLogic.GetBySkuCodeAsync(skuCode, CatalogViewScope.Store));
    }

    [HttpGet("by-product/{productId:guid}")]
    public async Task<IActionResult> GetByProductId(Guid productId)
    {
        if (IsWarehouse) return Forbid();
        return Ok(await _skuLogic.GetByProductIdAsync(productId, CatalogViewScope.Store));
    }
}
