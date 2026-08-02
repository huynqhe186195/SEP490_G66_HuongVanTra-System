using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.UseCases;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/price-books")]
public class PriceBooksController(PriceBookLogic _priceBookLogic) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20) =>
        Ok(await _priceBookLogic.GetPagedAsync(new GetPriceBooksRequest(search, isActive, page, pageSize)));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id) =>
        Ok(await _priceBookLogic.GetByIdAsync(id));

    [HttpPost]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public async Task<IActionResult> Create([FromBody] CreatePriceBookRequest request)
    {
        var result = await _priceBookLogic.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePriceBookRequest request) =>
        Ok(await _priceBookLogic.UpdateAsync(id, request));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _priceBookLogic.DeleteAsync(id);
        return NoContent();
    }
}
