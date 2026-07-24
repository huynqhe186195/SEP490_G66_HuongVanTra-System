using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application;
using ProductService.Application.DTOs.Requests;
using ProductService.Infrastructure.UseCases;
using ProductService.WebAPI.Extensions;
using HuongVanTra.Shared.Auth;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/skus")]
public class ProductSkusController(ProductSkuLogic _skuLogic) : ControllerBase
{
    private static readonly object MasterDataWriteDisabled = new
    {
        message = "SKU master data phải đi qua workflow phê duyệt Product. Vui lòng dùng /api/v1/product-creation-requests."
    };

    [HttpGet]
    [Authorize(Roles = "Warehouse,Accountant,Admin")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] Guid? productId,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20) =>
        Ok(await _skuLogic.GetPagedAsync(
            new GetProductSkusRequest(search, productId, isActive, page, pageSize),
            User.GetCatalogViewScope()));

    /// <summary>
    /// Internal catalog for InventoryService sell-before-deduct (BOM check).
    /// Anonymous service-to-service call; always uses warehouse scope so BOM + materials are visible.
    /// </summary>
    [HttpGet("bom-catalog")]
    [AllowAnonymous]
    public async Task<IActionResult> GetBomCatalog(
        [FromQuery] List<Guid>? skuIds,
        CancellationToken ct) =>
        Ok(await _skuLogic.GetBomCatalogBySkuIdsAsync(skuIds, CatalogViewScope.Warehouse, ct));

    /// <summary>
    /// Minimal service-to-service catalog used by OrderService to validate base-unit quantities.
    /// </summary>
    [HttpGet("order-catalog")]
    [AllowAnonymous]
    public async Task<IActionResult> GetOrderCatalog(
        [FromQuery] List<Guid>? skuIds,
        CancellationToken ct) =>
        Ok(await _skuLogic.GetOrderCatalogBySkuIdsAsync(skuIds, ct));

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Warehouse,Accountant,Admin")]
    public async Task<IActionResult> GetById(Guid id) =>
        Ok(await _skuLogic.GetByIdAsync(id, User.GetCatalogViewScope()));

    [HttpGet("by-code/{skuCode}")]
    [Authorize(Roles = "Warehouse,Accountant,Admin")]
    public async Task<IActionResult> GetBySkuCode(string skuCode) =>
        Ok(await _skuLogic.GetBySkuCodeAsync(skuCode, User.GetCatalogViewScope()));

    [HttpGet("by-product/{productId:guid}")]
    [Authorize(Roles = "Warehouse,Accountant,Admin")]
    public async Task<IActionResult> GetByProductId(Guid productId) =>
        Ok(await _skuLogic.GetByProductIdAsync(productId, User.GetCatalogViewScope()));

    [HttpPost]
    [Authorize(Roles = "Warehouse")]
    public IActionResult Create([FromBody] CreateProductSkuRequest request) =>
        StatusCode(StatusCodes.Status410Gone, MasterDataWriteDisabled);

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Warehouse")]
    public IActionResult Update(Guid id, [FromBody] UpdateProductSkuRequest request) =>
        StatusCode(StatusCodes.Status410Gone, MasterDataWriteDisabled);

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Warehouse")]
    public IActionResult Delete(Guid id) =>
        StatusCode(StatusCodes.Status410Gone, MasterDataWriteDisabled);
}
