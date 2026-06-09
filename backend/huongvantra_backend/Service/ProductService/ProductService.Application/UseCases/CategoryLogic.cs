using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class CategoryLogic(ICategoryRepository _categoryRepository)
{
    public async Task<List<CategoryResponse>> GetAllAsync(bool? isDeleted = null)
    {
        var categories = await _categoryRepository.GetAllAsync(isDeleted);
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
            throw new ProductValidationException(
                $"Danh mục '{input.Name}' đã tồn tại (kể cả đang ngừng hoặc đã xóa mềm). Hãy kích hoạt lại bản cũ thay vì tạo mới.");

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
        if (category.IsDeleted)
            throw new ProductValidationException("Không thể sửa danh mục đã xóa mềm. Hãy kích hoạt lại trước.");

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
        if (category.IsDeleted)
            throw new ProductValidationException("Danh mục đã được xóa mềm.");
        await _categoryRepository.DeleteAsync(category);
    }

    public async Task<CategoryResponse> RestoreAsync(int id)
    {
        var category = await _categoryRepository.GetByIdAsync(id, includeDeleted: true)
            ?? throw new CategoryNotFoundException(id);
        if (!category.IsDeleted)
            throw new ProductValidationException("Danh mục chưa bị xóa mềm.");

        if (await _categoryRepository.ExistsNameAsync(category.Name, excludeId: id, includeDeleted: false))
            throw new ProductValidationException(
                $"Không thể kích hoạt lại — đã có danh mục khác tên '{category.Name}'. Đổi tên bản mới hoặc xóa bản trùng trước.");

        await _categoryRepository.RestoreAsync(category);
        return MapToResponse((await _categoryRepository.GetByIdAsync(id))!);
    }

    private static CategoryResponse MapToResponse(Category c) =>
        new(c.Id, c.Name, c.Description, c.ParentId, c.IsActive, c.IsDeleted, c.CreatedAt);
}
