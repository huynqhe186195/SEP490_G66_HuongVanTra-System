using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.UseCases;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/brands")]
public class BrandsController(BrandLogic _brandLogic) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool? isDeleted) =>
        Ok(await _brandLogic.GetAllAsync(isDeleted));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id) =>
        Ok(await _brandLogic.GetByIdAsync(id));

    [HttpPost]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Create([FromBody] CreateBrandRequest request)
    {
        var result = await _brandLogic.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateBrandRequest request) =>
        Ok(await _brandLogic.UpdateAsync(id, request));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Delete(int id)
    {
        await _brandLogic.DeleteAsync(id);
        return NoContent();
    }

    [HttpPost("{id:int}/restore")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Restore(int id) =>
        Ok(await _brandLogic.RestoreAsync(id));
}
