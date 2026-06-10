using ProductService.Application;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class ProductSkuLogic(
    IProductSkuRepository _skuRepository,
    IProductRepository _productRepository)
{
    public async Task<PagedResponse<ProductSkuResponse>> GetPagedAsync(
        GetProductSkusRequest request,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (request is null)
            throw new ProductValidationException("Request là bắt buộc.");

        ProductInputValidator.ValidatePagination(request.Page, request.PageSize);

        var (items, total) = await _skuRepository.GetPagedAsync(
            request.Search, request.ProductId, request.IsActive,
            request.Page, request.PageSize, scope);

        return new PagedResponse<ProductSkuResponse>(
            items.Select(MapToResponse).ToList(),
            request.Page,
            request.PageSize,
            total,
            (int)Math.Ceiling((double)total / request.PageSize));
    }

    public async Task<List<ProductSkuResponse>> GetAllAsync(
        bool includeInactive = false,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        var skus = await _skuRepository.GetAllAsync(includeInactive, scope);
        return skus.Select(MapToResponse).ToList();
    }

    public async Task<ProductSkuResponse> GetByIdAsync(Guid id, CatalogViewScope scope = CatalogViewScope.Store)
    {
        var sku = await _skuRepository.GetByIdAsync(id, scope)
            ?? throw new ProductSkuNotFoundException(id);
        return MapToResponse(sku);
    }

    public async Task<ProductSkuResponse> GetBySkuCodeAsync(string skuCode, CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (string.IsNullOrWhiteSpace(skuCode))
            throw new ProductValidationException("Mã SKU không được để trống.");

        var sku = await _skuRepository.GetBySkuCodeAsync(skuCode.Trim().ToUpperInvariant(), scope)
            ?? throw new ProductSkuNotFoundByCodeException(skuCode);
        return MapToResponse(sku);
    }

    public async Task<List<ProductSkuResponse>> GetByProductIdAsync(
        Guid productId,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (productId == Guid.Empty)
            throw new ProductValidationException("ProductId không hợp lệ.");

        _ = await _productRepository.GetByIdAsync(productId)
            ?? throw new ProductNotFoundException(productId);

        var skus = await _skuRepository.GetByProductIdAsync(productId, scope);
        return skus.Select(MapToResponse).ToList();
    }

    public async Task<ProductSkuResponse> CreateAsync(CreateProductSkuRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var input = ProductInputValidator.ValidateProductSku(
            request.ProductId, request.SkuCode, request.PackagingType,
            request.WeightInGrams, request.BasePrice, request.ImageUrl);

        _ = await _productRepository.GetByIdAsync(input.ProductId)
            ?? throw new ProductNotFoundException(input.ProductId);

        if (await _skuRepository.ExistsSkuCodeAsync(input.SkuCode))
            throw new DuplicateSkuCodeException(input.SkuCode);

        var sku = new ProductSku
        {
            ProductId = input.ProductId,
            SkuCode = input.SkuCode,
            PackagingType = input.PackagingType,
            WeightInGrams = input.WeightInGrams,
            BasePrice = input.BasePrice,
            ImageUrl = input.ImageUrl
        };

        var created = await _skuRepository.CreateAsync(sku);
        return MapToResponse(created);
    }

    public async Task<ProductSkuResponse> UpdateAsync(Guid id, UpdateProductSkuRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var sku = await _skuRepository.GetByIdAsync(id)
            ?? throw new ProductSkuNotFoundException(id);

        var input = ProductInputValidator.ValidateProductSku(
            sku.ProductId, request.SkuCode, request.PackagingType,
            request.WeightInGrams, request.BasePrice, request.ImageUrl,
            request.IsActive);

        if (await _skuRepository.ExistsSkuCodeAsync(input.SkuCode, id))
            throw new DuplicateSkuCodeException(input.SkuCode);

        sku.SkuCode = input.SkuCode;
        sku.PackagingType = input.PackagingType;
        sku.WeightInGrams = input.WeightInGrams;
        sku.BasePrice = input.BasePrice;
        sku.ImageUrl = input.ImageUrl;
        sku.IsActive = input.IsActive ?? sku.IsActive;
        sku.UpdatedAt = DateTime.UtcNow;

        var updated = await _skuRepository.UpdateAsync(sku);
        return MapToResponse(updated);
    }

    public async Task DeleteAsync(Guid id)
    {
        var sku = await _skuRepository.GetByIdAsync(id)
            ?? throw new ProductSkuNotFoundException(id);
        await _skuRepository.DeleteAsync(sku);
    }

    private static ProductSkuResponse MapToResponse(ProductSku s) =>
        new(
            s.Id,
            s.ProductId,
            s.Product?.Name ?? string.Empty,
            s.Product?.Category?.Name ?? string.Empty,
            s.SkuCode,
            s.PackagingType,
            s.WeightInGrams,
            s.BasePrice,
            s.ImageUrl,
            s.IsActive,
            s.CreatedAt,
            s.SyncedToStoreAt);
}
