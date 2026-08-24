using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.UseCases;
using ProductService.WebAPI.Extensions;
using HuongVanTra.Shared.Auth;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/categories")]
public class CategoriesController(CategoryLogic _categoryLogic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewCatalogAccess)]
    public async Task<IActionResult> GetAll([FromQuery] bool? isDeleted) =>
        Ok(await _categoryLogic.GetAllAsync(isDeleted, User.GetCatalogViewScope()));

    [HttpGet("{id:int}")]
    [Authorize(Policy = PermissionNames.ViewCatalogAccess)]
    public async Task<IActionResult> GetById(int id) =>
        Ok(await _categoryLogic.GetByIdAsync(id));

    [HttpPost]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public async Task<IActionResult> Create([FromBody] CreateCategoryRequest request)
    {
        var result = await _categoryLogic.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCategoryRequest request) =>
        Ok(await _categoryLogic.UpdateAsync(id, request));

    [HttpDelete("{id:int}")]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public async Task<IActionResult> Delete(int id)
    {
        await _categoryLogic.DeleteAsync(id);
        return NoContent();
    }

    [HttpPost("{id:int}/restore")]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public async Task<IActionResult> Restore(int id) =>
        Ok(await _categoryLogic.RestoreAsync(id));
}
