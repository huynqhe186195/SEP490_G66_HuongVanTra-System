using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class AttributeNameLogic(IAttributeNameRepository _repository)
{
    public async Task<List<AttributeNameResponse>> GetAllAsync(bool? isDeleted = null)
    {
        var items = await _repository.GetAllAsync(isDeleted);
        return items.Select(MapToResponse).ToList();
    }

    public async Task<AttributeNameResponse> GetByIdAsync(int id)
    {
        var item = await _repository.GetByIdAsync(id)
            ?? throw new AttributeNameNotFoundException(id);
        return MapToResponse(item);
    }

    public async Task<AttributeNameResponse> CreateAsync(CreateAttributeNameRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var name = ProductInputValidator.NormalizeAttributeDisplayName(request.Name);
        if (string.IsNullOrWhiteSpace(name))
            throw new ProductValidationException("Tên thuộc tính là bắt buộc.");
        if (name.Length < 2)
            throw new ProductValidationException("Tên thuộc tính phải có ít nhất 2 ký tự.");
        if (name.Length > 200)
            throw new ProductValidationException("Tên thuộc tính tối đa 200 ký tự.");

        if (await _repository.ExistsNameAsync(name))
            throw new ProductValidationException(
                $"Tên thuộc tính '{name}' đã tồn tại. Hãy kích hoạt lại bản cũ thay vì tạo mới.");

        var entity = new AttributeName { Name = name };
        var created = await _repository.CreateAsync(entity);
        return MapToResponse(created);
    }

    public async Task<AttributeNameResponse> UpdateAsync(int id, UpdateAttributeNameRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var entity = await _repository.GetByIdAsync(id)
            ?? throw new AttributeNameNotFoundException(id);
        if (entity.IsDeleted)
            throw new ProductValidationException("Không thể sửa tên thuộc tính đã xóa. Hãy kích hoạt lại trước.");

        var name = ProductInputValidator.NormalizeAttributeDisplayName(request.Name);
        if (string.IsNullOrWhiteSpace(name))
            throw new ProductValidationException("Tên thuộc tính là bắt buộc.");
        if (name.Length < 2)
            throw new ProductValidationException("Tên thuộc tính phải có ít nhất 2 ký tự.");
        if (name.Length > 200)
            throw new ProductValidationException("Tên thuộc tính tối đa 200 ký tự.");

        if (await _repository.ExistsNameAsync(name, excludeId: id))
            throw new ProductValidationException($"Tên thuộc tính '{name}' đã tồn tại.");

        entity.Name = name;
        if (request.IsActive.HasValue)
            entity.IsActive = request.IsActive.Value;
        entity.UpdatedAt = DateTime.UtcNow;

        var updated = await _repository.UpdateAsync(entity);
        return MapToResponse(updated);
    }

    public async Task DeleteAsync(int id)
    {
        var entity = await _repository.GetByIdAsync(id)
            ?? throw new AttributeNameNotFoundException(id);
        if (entity.IsDeleted)
            throw new ProductValidationException("Tên thuộc tính đã được xóa.");
        await _repository.DeleteAsync(entity);
    }

    public async Task<AttributeNameResponse> RestoreAsync(int id)
    {
        var entity = await _repository.GetByIdAsync(id, includeDeleted: true)
            ?? throw new AttributeNameNotFoundException(id);
        if (!entity.IsDeleted)
            throw new ProductValidationException("Tên thuộc tính chưa bị xóa.");

        if (await _repository.ExistsNameAsync(entity.Name, excludeId: id, includeDeleted: false))
            throw new ProductValidationException(
                $"Không thể kích hoạt lại — đã có tên thuộc tính khác tên '{entity.Name}'.");

        await _repository.RestoreAsync(entity);
        return MapToResponse((await _repository.GetByIdAsync(id))!);
    }

    private static AttributeNameResponse MapToResponse(AttributeName a) =>
        new(a.Id, a.Name, a.IsActive, a.IsDeleted, a.CreatedAt);
}
