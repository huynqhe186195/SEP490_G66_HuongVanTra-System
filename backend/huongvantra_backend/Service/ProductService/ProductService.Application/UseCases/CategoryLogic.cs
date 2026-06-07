using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
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
        if (request.ParentId.HasValue)
        {
            _ = await _categoryRepository.GetByIdAsync(request.ParentId.Value)
                ?? throw new CategoryNotFoundException(request.ParentId.Value);
        }

        var category = new Category
        {
            Name = request.Name,
            Description = request.Description,
            ParentId = request.ParentId
        };

        var created = await _categoryRepository.CreateAsync(category);
        return MapToResponse(created);
    }

    public async Task<CategoryResponse> UpdateAsync(int id, UpdateCategoryRequest request)
    {
        var category = await _categoryRepository.GetByIdAsync(id)
            ?? throw new CategoryNotFoundException(id);

        if (request.ParentId.HasValue && request.ParentId.Value != id)
        {
            _ = await _categoryRepository.GetByIdAsync(request.ParentId.Value)
                ?? throw new CategoryNotFoundException(request.ParentId.Value);
        }

        category.Name = request.Name;
        category.Description = request.Description;
        category.ParentId = request.ParentId;
        category.UpdatedAt = DateTime.UtcNow;

        var updated = await _categoryRepository.UpdateAsync(category);
        return MapToResponse(updated);
    }

    public async Task DeleteAsync(int id)
    {
        var category = await _categoryRepository.GetByIdAsync(id)
            ?? throw new CategoryNotFoundException(id);
        await _categoryRepository.DeleteAsync(category);
    }

    private static CategoryResponse MapToResponse(Category c) =>
        new(c.Id, c.Name, c.Description, c.ParentId, c.CreatedAt);
}
