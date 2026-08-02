using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/suppliers")]
[Authorize]
public class SuppliersController(InventoryLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] string? search = null,
        [FromQuery] bool includeDeleted = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        return Ok(await _logic.GetSuppliersAsync(search, includeDeleted, page, pageSize, ct));
    }

    [HttpGet("active")]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetActiveList(CancellationToken ct)
    {
        return Ok(await _logic.GetActiveSuppliersAsync(ct));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewInventory)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        return Ok(await _logic.GetSupplierAsync(id, ct));
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.ManageSuppliers)]
    public async Task<IActionResult> Create([FromBody] CreateSupplierRequest request, CancellationToken ct)
    {
        var created = await _logic.CreateSupplierAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageSuppliers)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSupplierRequest request, CancellationToken ct)
    {
        return Ok(await _logic.UpdateSupplierAsync(id, request, ct));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageSuppliers)]
    public async Task<IActionResult> SoftDelete(Guid id, CancellationToken ct)
    {
        return Ok(await _logic.SoftDeleteSupplierAsync(id, ct));
    }

    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = PermissionNames.ManageSuppliers)]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
    {
        return Ok(await _logic.RestoreSupplierAsync(id, ct));
    }
}
