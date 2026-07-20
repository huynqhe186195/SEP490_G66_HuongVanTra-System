using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.UseCases;

namespace ProductService.WebAPI.Controllers;

/// <summary>
/// Endpoint hàng hóa dành riêng cho Admin và Manager.
/// Luôn trả catalog cửa hàng (SKU đã đồng bộ), không expose master catalog kho.
/// </summary>
[ApiController]
[Route("api/v1/store/products")]
[Authorize(Roles = "Admin,Manager,Sale")]
public class StoreProductsController(ProductLogic _productLogic) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] int? categoryId,
        [FromQuery] bool? isActive,
        [FromQuery] string? productType,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20) =>
        Ok(await _productLogic.GetPagedAsync(
            new GetProductsRequest(search, categoryId, isActive, null, productType, page, pageSize),
            CatalogViewScope.Store));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id) =>
        Ok(await _productLogic.GetByIdAsync(id, CatalogViewScope.Store));
}
