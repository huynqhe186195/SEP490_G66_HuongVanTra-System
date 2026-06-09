using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.UseCases;
using HuongVanTra.Shared.Auth;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/products")]
public class ProductsController(ProductLogic _productLogic) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] int? categoryId,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20) =>
        Ok(await _productLogic.GetPagedAsync(new GetProductsRequest(search, categoryId, isActive, page, pageSize)));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id) =>
        Ok(await _productLogic.GetByIdAsync(id));

    [HttpPost]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> Create([FromBody] CreateProductRequest request)
    {
        var result = await _productLogic.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductRequest request) =>
        Ok(await _productLogic.UpdateAsync(id, request));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _productLogic.DeleteAsync(id);
        return NoContent();
    }
}
