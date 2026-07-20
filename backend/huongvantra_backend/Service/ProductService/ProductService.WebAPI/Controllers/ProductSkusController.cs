using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] Guid? productId,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20) =>
        Ok(await _skuLogic.GetPagedAsync(
            new GetProductSkusRequest(search, productId, isActive, page, pageSize),
            User.GetCatalogViewScope()));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id) =>
        Ok(await _skuLogic.GetByIdAsync(id, User.GetCatalogViewScope()));

    [HttpGet("by-code/{skuCode}")]
    public async Task<IActionResult> GetBySkuCode(string skuCode) =>
        Ok(await _skuLogic.GetBySkuCodeAsync(skuCode, User.GetCatalogViewScope()));

    [HttpGet("by-product/{productId:guid}")]
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
