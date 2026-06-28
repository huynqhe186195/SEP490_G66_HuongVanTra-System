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
            v.SyncedToStoreAt);
}
