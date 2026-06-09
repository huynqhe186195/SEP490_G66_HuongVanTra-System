using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class ProductLogic(IProductRepository _productRepository, ICategoryRepository _categoryRepository)
{
    public async Task<PagedResponse<ProductResponse>> GetPagedAsync(GetProductsRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request là bắt buộc.");

        ProductInputValidator.ValidatePagination(request.Page, request.PageSize);

        var (items, total) = await _productRepository.GetPagedAsync(
            request.Search, request.CategoryId, request.IsActive, request.IsDeleted,
            request.Page, request.PageSize);

        return new PagedResponse<ProductResponse>(
            items.Select(MapToResponse).ToList(),
            request.Page,
            request.PageSize,
            total,
            (int)Math.Ceiling((double)total / request.PageSize));
    }

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
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var input = ProductInputValidator.ValidateProduct(
            request.CategoryId, request.Name, request.Origin,
            request.FlavorProfile, request.BrewingGuide, request.Description);

        _ = await _categoryRepository.GetByIdAsync(input.CategoryId)
            ?? throw new CategoryNotFoundException(input.CategoryId);

        if (await _productRepository.ExistsNameAsync(input.Name))
            throw new ProductValidationException(
                $"Sản phẩm '{input.Name}' đã tồn tại (kể cả đang ngừng kinh doanh hoặc đã xóa mềm). Hãy kích hoạt lại bản cũ thay vì tạo mới.");

        var product = new Product
        {
            CategoryId = input.CategoryId,
            Name = input.Name,
            Origin = input.Origin,
            FlavorProfile = input.FlavorProfile,
            BrewingGuide = input.BrewingGuide,
            Description = input.Description
        };

        var created = await _productRepository.CreateAsync(product);
        return MapToResponse(created);
    }

    public async Task<ProductResponse> UpdateAsync(Guid id, UpdateProductRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new ProductNotFoundException(id);
        if (product.IsDeleted)
            throw new ProductValidationException("Không thể sửa sản phẩm đã xóa mềm. Hãy kích hoạt lại trước.");

        var input = ProductInputValidator.ValidateProduct(
            request.CategoryId, request.Name, request.Origin,
            request.FlavorProfile, request.BrewingGuide, request.Description,
            request.IsActive);

        _ = await _categoryRepository.GetByIdAsync(input.CategoryId)
            ?? throw new CategoryNotFoundException(input.CategoryId);

        if (await _productRepository.ExistsNameAsync(input.Name, excludeProductId: id))
            throw new ProductValidationException($"Sản phẩm với tên '{input.Name}' đã tồn tại.");

        product.CategoryId = input.CategoryId;
        product.Name = input.Name;
        product.Origin = input.Origin;
        product.FlavorProfile = input.FlavorProfile;
        product.BrewingGuide = input.BrewingGuide;
        product.Description = input.Description;
        product.IsActive = input.IsActive ?? product.IsActive;
        product.UpdatedAt = DateTime.UtcNow;

        var updated = await _productRepository.UpdateAsync(product);
        return MapToResponse(updated);
    }

    public async Task DeleteAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new ProductNotFoundException(id);
        if (product.IsDeleted)
            throw new ProductValidationException("Sản phẩm đã được xóa mềm.");
        await _productRepository.DeleteAsync(product);
    }

    public async Task<ProductResponse> RestoreAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id, includeDeleted: true)
            ?? throw new ProductNotFoundException(id);
        if (!product.IsDeleted)
            throw new ProductValidationException("Sản phẩm chưa bị xóa mềm.");

        if (await _productRepository.ExistsNameAsync(product.Name, excludeProductId: id, includeDeleted: false))
            throw new ProductValidationException(
                $"Không thể kích hoạt lại — đã có sản phẩm khác tên '{product.Name}'. Đổi tên bản mới hoặc xóa bản trùng trước.");

        await _productRepository.RestoreAsync(product);
        return MapToResponse((await _productRepository.GetByIdAsync(id))!);
    }

    private static ProductResponse MapToResponse(Product p) => new(
        p.Id, p.CategoryId, p.Category?.Name ?? string.Empty,
        p.Name, p.Origin, p.FlavorProfile, p.BrewingGuide, p.Description,
        p.IsActive, p.IsDeleted, p.CreatedAt,
        p.Skus.Select(s => new ProductSkuResponse(
            s.Id, s.ProductId, p.Name, p.Category?.Name ?? string.Empty,
            s.SkuCode, s.PackagingType,
            s.WeightInGrams, s.BasePrice, s.ImageUrl, s.IsActive, s.CreatedAt))
        .ToList());
}
