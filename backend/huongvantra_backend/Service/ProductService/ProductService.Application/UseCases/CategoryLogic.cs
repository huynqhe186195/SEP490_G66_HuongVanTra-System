using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class CategoryLogic(ICategoryRepository _categoryRepository)
{
    public async Task<List<CategoryResponse>> GetAllAsync()
    {
        var categories = await _categoryRepository.GetAllAsync();
        return categories.Select(MapToResponse).ToList();
    }

    public async Task<CategoryResponse> GetByIdAsync(int id)
    {
        var category = await _categoryRepository.GetByIdAsync(id)
            ?? throw new CategoryNotFoundException(id);
        return MapToResponse(category);
    }

    public async Task<CategoryResponse> CreateAsync(CreateCategoryRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var input = ProductInputValidator.ValidateCategory(request.Name, request.Description, request.ParentId);

        if (await _categoryRepository.ExistsNameAsync(input.Name))
            throw new ProductValidationException($"Danh mục với tên '{input.Name}' đã tồn tại.");

        if (input.ParentId.HasValue)
            _ = await _categoryRepository.GetByIdAsync(input.ParentId.Value)
                ?? throw new CategoryNotFoundException(input.ParentId.Value);

        var category = new Category
        {
            Name = input.Name,
            Description = input.Description,
            ParentId = input.ParentId
        };

        var created = await _categoryRepository.CreateAsync(category);
        return MapToResponse(created);
    }

    public async Task<CategoryResponse> UpdateAsync(int id, UpdateCategoryRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var category = await _categoryRepository.GetByIdAsync(id)
            ?? throw new CategoryNotFoundException(id);

        var input = ProductInputValidator.ValidateCategory(request.Name, request.Description, request.ParentId);

        if (await _categoryRepository.ExistsNameAsync(input.Name, excludeId: id))
            throw new ProductValidationException($"Danh mục với tên '{input.Name}' đã tồn tại.");

        if (input.ParentId.HasValue)
        {
            if (input.ParentId.Value == id)
                throw new ProductValidationException("Danh mục không thể là cha của chính nó.");
            _ = await _categoryRepository.GetByIdAsync(input.ParentId.Value)
                ?? throw new CategoryNotFoundException(input.ParentId.Value);
        }

        category.Name = input.Name;
        category.Description = input.Description;
        category.ParentId = input.ParentId;
        if (request.IsActive.HasValue)
            category.IsActive = request.IsActive.Value;
        category.UpdatedAt = DateTime.UtcNow;

        var updated = await _categoryRepository.UpdateAsync(category);
        return MapToResponse(updated);
    }

    public async Task DeleteAsync(int id)
    {
        var category = await _categoryRepository.GetByIdAsync(id)
            ?? throw new CategoryNotFoundException(id);
        category.IsActive = false;
        category.UpdatedAt = DateTime.UtcNow;
        await _categoryRepository.UpdateAsync(category);
    }

    private static CategoryResponse MapToResponse(Category c) =>
        new(c.Id, c.Name, c.Description, c.ParentId, c.IsActive, c.CreatedAt);
}
