using HuongVanTra.Shared.Auth;
using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.UseCases;
using InventoryService.WebAPI.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InventoryService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/inventory/supplier-products")]
[Authorize]
public class SupplierProductsController(InventoryLogic _logic) : ControllerBase
{
    private const string ViewRoles = "Admin,Manager,Accountant,Warehouse";
    private const string WriteRoles = "Accountant";

    [HttpGet]
    [Authorize(Roles = ViewRoles)]
    public async Task<IActionResult> GetList(
        CancellationToken ct,
        [FromQuery] Guid? supplierId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? productType = null,
        [FromQuery] bool includeInactive = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        return Ok(await _logic.GetSupplierProductsAsync(
            supplierId, search, productType, includeInactive, page, pageSize, ct));
    }

    /// <summary>Danh mục hàng đang cung ứng — dùng để lọc SKU và điền sẵn giá chào khi lập phiếu nhập.</summary>
    [HttpGet("by-supplier/{supplierId:guid}/active")]
    [Authorize(Roles = ViewRoles)]
    public async Task<IActionResult> GetActiveBySupplier(Guid supplierId, CancellationToken ct)
    {
        return Ok(await _logic.GetActiveSupplierProductsAsync(supplierId, ct));
    }

    /// <summary>Các nhà cung cấp đang cung ứng một SKU, sắp xếp theo giá chào tăng dần.</summary>
    [HttpGet("by-sku/{skuId:guid}")]
    [Authorize(Roles = ViewRoles)]
    public async Task<IActionResult> GetBySku(Guid skuId, CancellationToken ct)
    {
        return Ok(await _logic.GetSupplierProductsBySkuAsync(skuId, ct));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = ViewRoles)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        return Ok(await _logic.GetSupplierProductAsync(id, ct));
    }

    [HttpGet("{id:guid}/price-history")]
    [Authorize(Roles = ViewRoles)]
    public async Task<IActionResult> GetPriceHistory(Guid id, CancellationToken ct)
    {
        return Ok(await _logic.GetSupplierProductPriceHistoryAsync(id, ct));
    }

    [HttpPost("by-supplier/{supplierId:guid}")]
    [Authorize(Roles = WriteRoles)]
    public async Task<IActionResult> Create(
        Guid supplierId,
        [FromBody] CreateSupplierProductRequest request,
        CancellationToken ct)
    {
        var created = await _logic.CreateSupplierProductAsync(supplierId, request, User.ToCreatorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    /// <summary>Import danh mục hàng cung ứng từ Excel. Dòng lỗi bị bỏ qua, dòng hợp lệ vẫn được ghi.</summary>
    [HttpPost("by-supplier/{supplierId:guid}/import")]
    [Authorize(Roles = WriteRoles)]
    public async Task<IActionResult> Import(
        Guid supplierId,
        [FromBody] ImportSupplierProductsRequest request,
        CancellationToken ct)
    {
        return Ok(await _logic.ImportSupplierProductsAsync(supplierId, request, User.ToCreatorSnapshot(), ct));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = WriteRoles)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateSupplierProductRequest request,
        CancellationToken ct)
    {
        return Ok(await _logic.UpdateSupplierProductAsync(id, request, ct));
    }

    [HttpPut("{id:guid}/price")]
    [Authorize(Roles = WriteRoles)]
    public async Task<IActionResult> UpdatePrice(
        Guid id,
        [FromBody] UpdateSupplierProductPriceRequest request,
        CancellationToken ct)
    {
        return Ok(await _logic.UpdateSupplierProductPriceAsync(id, request, User.ToCreatorSnapshot(), ct));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = WriteRoles)]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken ct)
    {
        return Ok(await _logic.DeactivateSupplierProductAsync(id, ct));
    }

    [HttpPost("{id:guid}/restore")]
    [Authorize(Roles = WriteRoles)]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
    {
        return Ok(await _logic.RestoreSupplierProductAsync(id, ct));
    }
}
