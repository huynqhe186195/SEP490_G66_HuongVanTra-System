using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.UseCases;
using ProductService.WebAPI.Extensions;
using HuongVanTra.Shared.Auth;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/products")]
public class ProductsController(ProductLogic _productLogic) : ControllerBase
{
    private static readonly object MasterDataWriteDisabled = new
    {
        message = "Product master data phải đi qua workflow phê duyệt. Vui lòng dùng /api/v1/product-creation-requests hoặc /api/v1/product-deletion-requests."
    };

    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewCatalogAccess)]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] int? categoryId,
        [FromQuery] bool? isActive,
        [FromQuery] bool? isDeleted,
        [FromQuery] string? productType,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20) =>
        Ok(await _productLogic.GetPagedAsync(
            new GetProductsRequest(search, categoryId, isActive, isDeleted, productType, page, pageSize),
            User.GetCatalogViewScope()));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewCatalogAccess)]
    public async Task<IActionResult> GetById(Guid id) =>
        Ok(await _productLogic.GetByIdAsync(id, User.GetCatalogViewScope()));

    [HttpGet("variants/{variantId:guid}/bom")]
    [Authorize(Policy = PermissionNames.ViewCatalogAccess)]
    public async Task<IActionResult> GetVariantBom(Guid variantId) =>
        Ok(await _productLogic.GetVariantBomAsync(variantId));

    [HttpPut("variants/{variantId:guid}/bom")]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public IActionResult UpdateVariantBom(Guid variantId, [FromBody] UpdateVariantBomRequest request) =>
        StatusCode(StatusCodes.Status410Gone, MasterDataWriteDisabled);

    [HttpPost]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public IActionResult Create([FromBody] CreateProductRequest request) =>
        StatusCode(StatusCodes.Status410Gone, MasterDataWriteDisabled);

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public IActionResult Update(Guid id, [FromBody] UpdateProductRequest request) =>
        StatusCode(StatusCodes.Status410Gone, MasterDataWriteDisabled);

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public IActionResult Delete(Guid id) =>
        StatusCode(StatusCodes.Status410Gone, MasterDataWriteDisabled);

    // Giữ Roles: endpoint legacy trả 410 Gone, chỉ Admin khôi phục sản phẩm đã xóa;
    // MANAGE_CATALOG chỉ Warehouse nên sẽ loại Admin, chưa có permission phù hợp cho thao tác này.
    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public IActionResult Restore(Guid id) =>
        StatusCode(StatusCodes.Status410Gone, MasterDataWriteDisabled);
}
