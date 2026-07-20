using Microsoft.EntityFrameworkCore;
using ProductService.Application;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Exceptions;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.UseCases;

// Serves the legacy /api/v1/skus route using ProductVariant data so that
// store, POS, and OrderService continue working without URL changes.
public class ProductSkuLogic(
    IProductRepository _productRepository,
    ProductDbContext _db)
{
    public async Task<PagedResponse<ProductSkuResponse>> GetPagedAsync(
        GetProductSkusRequest request,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (request is null)
            throw new ProductValidationException("Request là bắt buộc.");

        ProductInputValidator.ValidatePagination(request.Page, request.PageSize);

        var query = BuildVariantQuery(scope);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = request.Search.Trim().ToLower();
            query = query.Where(v =>
                v.SkuCode.ToLower().Contains(s) ||
                (v.Barcode != null && v.Barcode.ToLower().Contains(s)) ||
                v.VariantName.ToLower().Contains(s) ||
                v.Product.Name.ToLower().Contains(s) ||
                (v.Product.Category != null && v.Product.Category.Name.ToLower().Contains(s)));
        }

        if (request.ProductId.HasValue)
            query = query.Where(v => v.ProductId == request.ProductId.Value);

        if (request.IsActive == true)
            query = query.Where(v => v.IsActive);
        else if (request.IsActive == false)
            query = query.Where(v => !v.IsActive);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderBy(v => v.SkuCode)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync();

        return new PagedResponse<ProductSkuResponse>(
            items.Select(MapToResponse).ToList(),
            request.Page,
            request.PageSize,
            totalCount,
            (int)Math.Ceiling((double)totalCount / request.PageSize));
    }

    public async Task<List<ProductSkuResponse>> GetAllAsync(
        bool includeInactive = false,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        var query = BuildVariantQuery(scope);
        if (!includeInactive) query = query.Where(v => v.IsActive);
        var items = await query.OrderBy(v => v.SkuCode).ToListAsync();
        return items.Select(MapToResponse).ToList();
    }

    public async Task<ProductSkuResponse> GetByIdAsync(Guid id, CatalogViewScope scope = CatalogViewScope.Store)
    {
        var variant = await BuildVariantQuery(scope).FirstOrDefaultAsync(v => v.Id == id)
            ?? throw new ProductSkuNotFoundException(id);
        return MapToResponse(variant);
    }

    public async Task<ProductSkuResponse> GetBySkuCodeAsync(string skuCode, CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (string.IsNullOrWhiteSpace(skuCode))
            throw new ProductValidationException("Mã SKU không được để trống.");

        var normalized = skuCode.Trim().ToUpperInvariant();
        var variant = await BuildVariantQuery(scope).FirstOrDefaultAsync(v => v.SkuCode == normalized)
            ?? throw new ProductSkuNotFoundByCodeException(skuCode);
        return MapToResponse(variant);
    }

    public async Task<List<ProductSkuResponse>> GetByProductIdAsync(
        Guid productId,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (productId == Guid.Empty)
            throw new ProductValidationException("ProductId không hợp lệ.");

        _ = await _productRepository.GetByIdAsync(productId)
            ?? throw new ProductNotFoundException(productId);

        var items = await BuildVariantQuery(scope)
            .Where(v => v.ProductId == productId)
            .OrderBy(v => v.SkuCode)
            .ToListAsync();
        return items.Select(MapToResponse).ToList();
    }

    public async Task<ProductBomCatalogResponse> GetBomCatalogBySkuIdsAsync(
        List<Guid>? skuIds,
        CatalogViewScope scope = CatalogViewScope.Store,
        CancellationToken ct = default)
    {
        var targetIds = (skuIds ?? [])
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToHashSet();
        if (targetIds.Count == 0)
            return new ProductBomCatalogResponse([]);

        var targetQuery = _db.ProductVariants
            .Include(v => v.Product)
            .Include(v => v.BomLines)
                .ThenInclude(b => b.Material)
                    .ThenInclude(m => m.Units)
            .Include(v => v.BomLines)
                .ThenInclude(b => b.ComponentVariant)
            .Where(v => targetIds.Contains(v.Id));

        if (scope == CatalogViewScope.Store)
            targetQuery = targetQuery.Where(v =>
                v.SyncedToStoreAt != null ||
                v.Product.SyncedToStoreAt != null ||
                v.Product.ProductType == ProductService.Domain.Enums.ProductType.NGUYEN_LIEU);

        var targetVariants = await targetQuery.ToListAsync(ct);
        var activeBomLines = targetVariants
            .SelectMany(v => v.BomLines)
            .Where(line => !line.IsDeleted)
            .ToList();

        var componentVariantIds = activeBomLines
            .Where(line => line.ComponentVariantId.HasValue)
            .Select(line => line.ComponentVariantId!.Value)
            .Where(id => id != Guid.Empty)
            .ToHashSet();

        var legacyMaterialProductIds = activeBomLines
            .Where(line => !line.ComponentVariantId.HasValue)
            .Select(line => line.MaterialId)
            .Where(id => id != Guid.Empty)
            .ToHashSet();

        List<ProductVariant> componentVariants = componentVariantIds.Count == 0 && legacyMaterialProductIds.Count == 0
            ? []
            : await _db.ProductVariants
                .Include(v => v.Product)
                .Where(v =>
                    componentVariantIds.Contains(v.Id) ||
                    legacyMaterialProductIds.Contains(v.ProductId))
                .ToListAsync(ct);

        var variants = targetVariants
            .Concat(componentVariants)
            .GroupBy(v => v.Id)
            .Select(group => group.First())
            .ToList();

        var products = variants
            .Where(v => v.Product != null)
            .GroupBy(v => v.ProductId)
            .Select(group =>
            {
                var product = group.First().Product;
                return new ProductBomCatalogProductResponse(
                    product.Id,
                    product.Name,
                    product.ProductType.ToString(),
                    product.InventoryUnit.ToString(),
                    product.BaseUnit,
                    product.IsActive,
                    group
                        .OrderBy(v => v.SkuCode)
                        .Select(v => MapBomCatalogVariant(v, targetIds.Contains(v.Id)))
                        .ToList());
            })
            .ToList();

        return new ProductBomCatalogResponse(products);
    }

    public Task<ProductSkuResponse> CreateAsync(CreateProductSkuRequest request) =>
        throw new ProductValidationException("Quản lý biến thể phải thực hiện qua API sản phẩm (/api/v1/products).");

    public Task<ProductSkuResponse> UpdateAsync(Guid id, UpdateProductSkuRequest request) =>
        throw new ProductValidationException("Quản lý biến thể phải thực hiện qua API sản phẩm (/api/v1/products).");

    public Task DeleteAsync(Guid id) =>
        throw new ProductValidationException("Quản lý biến thể phải thực hiện qua API sản phẩm (/api/v1/products).");

    private IQueryable<ProductVariant> BuildVariantQuery(CatalogViewScope scope)
    {
        var query = _db.ProductVariants
            .Include(v => v.Product)
                .ThenInclude(p => p.Category)
            .AsQueryable();

        if (scope == CatalogViewScope.Store)
            query = query.Where(v => v.SyncedToStoreAt != null);

        return query;
    }

    private static ProductSkuResponse MapToResponse(ProductVariant v) =>
        new(
            v.Id,
            v.ProductId,
            v.Product?.Name ?? string.Empty,
            v.Product?.CategoryId,
            v.Product?.Category?.Name ?? string.Empty,
            v.SkuCode,
            v.Barcode,
            v.VariantName,
            v.WeightInGrams,
            v.RetailPrice,
            v.CostPrice,
            v.RetailPrice,
            v.MinStock,
            v.MaxStock,
            v.IsSellable,
            v.AllowRewardPoints,
            v.ImageUrl,
            v.IsActive,
            v.CreatedAt,
            v.SyncedToStoreAt,
            v.UnitName,
            v.ConversionRate,
            v.BaseVariantId,
            v.IsBaseUnitVariant,
            v.IsAutoGeneratedSku);

    private static ProductBomCatalogVariantResponse MapBomCatalogVariant(ProductVariant v, bool includeBomLines)
    {
        var activeBomLines = includeBomLines
            ? v.BomLines.Where(b => !b.IsDeleted).ToList()
            : [];

        return new ProductBomCatalogVariantResponse(
            v.Id,
            v.ProductId,
            v.SkuCode,
            v.VariantName,
            v.IsActive,
            v.IsSellable,
            activeBomLines.Count > 0,
            activeBomLines.Count,
            activeBomLines.Select(MapBomLineResponse).ToList());
    }

    private static BomLineResponse MapBomLineResponse(ProductVariantBomLine b) => new(
        b.MaterialId,
        b.Material?.Name ?? string.Empty,
        b.Material is null ? null : InventoryUnitConverter.GetDisplayUnit(b.Material.InventoryUnit),
        b.Quantity,
        b.ComponentVariantId,
        b.ComponentVariant?.SkuCode,
        b.ComponentVariant?.VariantName,
        b.IsRequiredBaseComponent);
}
