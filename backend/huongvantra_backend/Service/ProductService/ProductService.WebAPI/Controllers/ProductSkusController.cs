using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application;
using ProductService.Application.DTOs.Requests;
using ProductService.Infrastructure.UseCases;
using ProductService.WebAPI.Extensions;
using ProductService.WebAPI.Filters;
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
    [Authorize(Policy = PermissionNames.ViewCatalogAccess)]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] Guid? productId,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20) =>
        Ok(await _skuLogic.GetPagedAsync(
            new GetProductSkusRequest(search, productId, isActive, page, pageSize),
            User.GetCatalogViewScope()));

    /// <summary>
    /// Internal catalog for InventoryService sell-before-deduct (BOM check).
    /// Service-to-service only (X-Internal-Api-Key); warehouse scope so BOM + materials are visible.
    /// </summary>
    [HttpGet("bom-catalog")]
    [AllowAnonymous]
    [RequireInternalApiKey]
    public async Task<IActionResult> GetBomCatalog(
        [FromQuery] List<Guid>? skuIds,
        CancellationToken ct) =>
        Ok(await _skuLogic.GetBomCatalogBySkuIdsAsync(skuIds, CatalogViewScope.Warehouse, ct));

    /// <summary>
    /// Minimal service-to-service catalog used by OrderService to validate base-unit quantities.
    /// </summary>
    [HttpGet("order-catalog")]
    [AllowAnonymous]
    [RequireInternalApiKey]
    public async Task<IActionResult> GetOrderCatalog(
        [FromQuery] List<Guid>? skuIds,
        CancellationToken ct) =>
        Ok(await _skuLogic.GetOrderCatalogBySkuIdsAsync(skuIds, ct));

    /// <summary>
    /// Internal catalog for DocumentService contract line items (SkuCode, ProductName, UnitName, RetailPrice).
    /// </summary>
    [HttpGet("contract-catalog")]
    public IActionResult GetContractCatalog(
        [FromQuery] List<Guid>? skuIds,
        CancellationToken ct) =>
        NotFound();

    /// <summary>
    /// Live SKU search for lập hợp đồng B2B (ContractFormPage). Always uses Warehouse scope so
    /// nguyên liệu/bao bì are searchable too — B2B contracts can sell raw materials wholesale.
    /// Independent from GetCatalogViewScope() (role "Warehouse") since Kế toán/Manager create contracts.
    /// </summary>
    [HttpGet("contract-search")]
    public IActionResult ContractSearch(
        [FromQuery] string? search,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20) =>
        NotFound();

    /// <summary>
    /// Internal catalog for InventoryService Supplier Receipt validation.
    /// It intentionally contains SKU capability only and never resolves BOM.
    /// </summary>
    [HttpGet("supplier-receipt-catalog")]
    [AllowAnonymous]
    [RequireInternalApiKey]
    public async Task<IActionResult> GetSupplierReceiptCatalog(
        [FromQuery] List<Guid>? skuIds,
        CancellationToken ct) =>
        Ok(await _skuLogic.GetSupplierReceiptCatalogBySkuIdsAsync(skuIds, ct));

    [HttpGet("accounting-cost-profit")]
    [Authorize(Policy = PermissionNames.ViewCost)]
    public async Task<IActionResult> GetAccountingCostProfit(CancellationToken ct) =>
        Ok(await _skuLogic.GetAccountingCostProfitAsync(ct));

    [HttpPatch("{id:guid}/retail-price")]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public async Task<IActionResult> UpdateRetailPrice(
        Guid id,
        [FromBody] UpdateProductVariantRetailPriceRequest request,
        CancellationToken ct) =>
        Ok(await _skuLogic.UpdateRetailPriceAsync(id, request, User.ToProductApprovalActorSnapshot(), ct));

    [HttpGet("{id:guid}/price-history")]
    [Authorize(Policy = PermissionNames.ViewCost)]
    public async Task<IActionResult> GetPriceHistory(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await _skuLogic.GetPriceHistoryAsync(id, page, pageSize, ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewCatalogAccess)]
    public async Task<IActionResult> GetById(Guid id) =>
        Ok(await _skuLogic.GetByIdAsync(id, User.GetCatalogViewScope()));

    [HttpGet("by-code/{skuCode}")]
    [Authorize(Policy = PermissionNames.ViewCatalogAccess)]
    public async Task<IActionResult> GetBySkuCode(string skuCode) =>
        Ok(await _skuLogic.GetBySkuCodeAsync(skuCode, User.GetCatalogViewScope()));

    [HttpGet("by-product/{productId:guid}")]
    [Authorize(Policy = PermissionNames.ViewCatalogAccess)]
    public async Task<IActionResult> GetByProductId(Guid productId) =>
        Ok(await _skuLogic.GetByProductIdAsync(productId, User.GetCatalogViewScope()));

    [HttpPost]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public IActionResult Create([FromBody] CreateProductSkuRequest request) =>
        StatusCode(StatusCodes.Status410Gone, MasterDataWriteDisabled);

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public IActionResult Update(Guid id, [FromBody] UpdateProductSkuRequest request) =>
        StatusCode(StatusCodes.Status410Gone, MasterDataWriteDisabled);

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public IActionResult Delete(Guid id) =>
        StatusCode(StatusCodes.Status410Gone, MasterDataWriteDisabled);
}
