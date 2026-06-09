using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.UseCases;
using HuongVanTra.Shared.Auth;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/skus")]
public class ProductSkusController(ProductSkuLogic _skuLogic) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] Guid? productId,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20) =>
        Ok(await _skuLogic.GetPagedAsync(new GetProductSkusRequest(search, productId, isActive, page, pageSize)));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id) =>
        Ok(await _skuLogic.GetByIdAsync(id));

    [HttpGet("by-code/{skuCode}")]
    public async Task<IActionResult> GetBySkuCode(string skuCode) =>
        Ok(await _skuLogic.GetBySkuCodeAsync(skuCode));

    [HttpGet("by-product/{productId:guid}")]
    public async Task<IActionResult> GetByProductId(Guid productId) =>
        Ok(await _skuLogic.GetByProductIdAsync(productId));

    [HttpPost]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Create([FromBody] CreateProductSkuRequest request)
    {
        var result = await _skuLogic.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductSkuRequest request) =>
        Ok(await _skuLogic.UpdateAsync(id, request));

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _skuLogic.DeleteAsync(id);
        return NoContent();
    }
}
