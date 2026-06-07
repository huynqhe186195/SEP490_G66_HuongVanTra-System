using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Domain.Entities;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class ProductLogic(IProductRepository _productRepository, ICategoryRepository _categoryRepository)
{
    public async Task<List<ProductResponse>> GetAllAsync(bool includeInactive = false)
    {
        var products = await _productRepository.GetAllAsync(includeInactive);
        return products.Select(MapToResponse).ToList();
    }

    public async Task<ProductResponse> GetByIdAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new ProductNotFoundException(id);
        return MapToResponse(product);
    }

    public async Task<ProductResponse> CreateAsync(CreateProductRequest request)
    {
        _ = await _categoryRepository.GetByIdAsync(request.CategoryId)
            ?? throw new CategoryNotFoundException(request.CategoryId);

        var product = new Product
        {
            CategoryId = request.CategoryId,
            Name = request.Name,
            Origin = request.Origin,
            FlavorProfile = request.FlavorProfile,
            BrewingGuide = request.BrewingGuide,
            Description = request.Description
        };

        var created = await _productRepository.CreateAsync(product);
        return MapToResponse(created);
    }

    public async Task<ProductResponse> UpdateAsync(Guid id, UpdateProductRequest request)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new ProductNotFoundException(id);

        _ = await _categoryRepository.GetByIdAsync(request.CategoryId)
            ?? throw new CategoryNotFoundException(request.CategoryId);

        product.CategoryId = request.CategoryId;
        product.Name = request.Name;
        product.Origin = request.Origin;
        product.FlavorProfile = request.FlavorProfile;
        product.BrewingGuide = request.BrewingGuide;
        product.Description = request.Description;
        product.IsActive = request.IsActive;
        product.UpdatedAt = DateTime.UtcNow;

        var updated = await _productRepository.UpdateAsync(product);
        return MapToResponse(updated);
    }

    public async Task DeleteAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new ProductNotFoundException(id);
        await _productRepository.DeleteAsync(product);
    }

    private static ProductResponse MapToResponse(Product p) => new(
        p.Id, p.CategoryId, p.Category?.Name ?? string.Empty,
        p.Name, p.Origin, p.FlavorProfile, p.BrewingGuide, p.Description,
        p.IsActive, p.CreatedAt,
        p.Skus.Select(s => new ProductSkuResponse(
            s.Id, s.ProductId, s.SkuCode, s.PackagingType,
            s.WeightInGrams, s.BasePrice, s.ImageUrl, s.IsActive, s.CreatedAt))
        .ToList());
}
