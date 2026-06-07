using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Domain.Entities;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class ProductSkuLogic(
    IProductSkuRepository _skuRepository,
    IProductRepository _productRepository,
    IProductEventPublisher _eventPublisher)
{
    public async Task<List<ProductSkuResponse>> GetAllAsync(bool includeInactive = false)
    {
        var skus = await _skuRepository.GetAllAsync(includeInactive);
        return skus.Select(MapToResponse).ToList();
    }

    public async Task<ProductSkuResponse> GetByIdAsync(Guid id)
    {
        var sku = await _skuRepository.GetByIdAsync(id)
            ?? throw new ProductSkuNotFoundException(id);
        return MapToResponse(sku);
    }

    public async Task<ProductSkuResponse> GetBySkuCodeAsync(string skuCode)
    {
        var sku = await _skuRepository.GetBySkuCodeAsync(skuCode)
            ?? throw new ProductSkuNotFoundByCodeException(skuCode);
        return MapToResponse(sku);
    }

    public async Task<List<ProductSkuResponse>> GetByProductIdAsync(Guid productId)
    {
        _ = await _productRepository.GetByIdAsync(productId)
            ?? throw new ProductNotFoundException(productId);
        var skus = await _skuRepository.GetByProductIdAsync(productId);
        return skus.Select(MapToResponse).ToList();
    }

    public async Task<ProductSkuResponse> CreateAsync(CreateProductSkuRequest request)
    {
        _ = await _productRepository.GetByIdAsync(request.ProductId)
            ?? throw new ProductNotFoundException(request.ProductId);

        if (await _skuRepository.ExistsSkuCodeAsync(request.SkuCode))
            throw new DuplicateSkuCodeException(request.SkuCode);

        var sku = new ProductSku
        {
            ProductId = request.ProductId,
            SkuCode = request.SkuCode,
            PackagingType = request.PackagingType,
            WeightInGrams = request.WeightInGrams,
            BasePrice = request.BasePrice,
            ImageUrl = request.ImageUrl
        };

        var created = await _skuRepository.CreateAsync(sku);

        await _eventPublisher.PublishSkuCreatedAsync(created.Id, created.SkuCode, created.WeightInGrams);

        return MapToResponse(created);
    }

    public async Task<ProductSkuResponse> UpdateAsync(Guid id, UpdateProductSkuRequest request)
    {
        var sku = await _skuRepository.GetByIdAsync(id)
            ?? throw new ProductSkuNotFoundException(id);

        if (await _skuRepository.ExistsSkuCodeAsync(request.SkuCode, id))
            throw new DuplicateSkuCodeException(request.SkuCode);

        sku.SkuCode = request.SkuCode;
        sku.PackagingType = request.PackagingType;
        sku.WeightInGrams = request.WeightInGrams;
        sku.BasePrice = request.BasePrice;
        sku.ImageUrl = request.ImageUrl;
        sku.IsActive = request.IsActive;
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
        new(s.Id, s.ProductId, s.SkuCode, s.PackagingType,
            s.WeightInGrams, s.BasePrice, s.ImageUrl, s.IsActive, s.CreatedAt);
}
