using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Domain.Entities;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class BrandLogic(IBrandRepository _brandRepository)
{
    public async Task<List<BrandResponse>> GetAllAsync(bool? isDeleted = null)
    {
        var brands = await _brandRepository.GetAllAsync(isDeleted);
        return brands.Select(MapToResponse).ToList();
    }

    public async Task<BrandResponse> GetByIdAsync(int id)
    {
        var brand = await _brandRepository.GetByIdAsync(id)
            ?? throw new BrandNotFoundException(id);
        return MapToResponse(brand);
    }

    public async Task<BrandResponse> CreateAsync(CreateBrandRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new ProductValidationException("Tên thương hiệu là bắt buộc.");
        if (name.Length < 2)
            throw new ProductValidationException("Tên thương hiệu phải có ít nhất 2 ký tự.");
        if (name.Length > 200)
            throw new ProductValidationException("Tên thương hiệu tối đa 200 ký tự.");

        if (await _brandRepository.ExistsNameAsync(name))
            throw new ProductValidationException(
                $"Thương hiệu '{name}' đã tồn tại. Hãy kích hoạt lại bản cũ thay vì tạo mới.");

        var brand = new Brand { Name = name };
        var created = await _brandRepository.CreateAsync(brand);
        return MapToResponse(created);
    }

    public async Task<BrandResponse> UpdateAsync(int id, UpdateBrandRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var brand = await _brandRepository.GetByIdAsync(id)
            ?? throw new BrandNotFoundException(id);
        if (brand.IsDeleted)
            throw new ProductValidationException("Không thể sửa thương hiệu đã xóa. Hãy kích hoạt lại trước.");

        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new ProductValidationException("Tên thương hiệu là bắt buộc.");
        if (name.Length < 2)
            throw new ProductValidationException("Tên thương hiệu phải có ít nhất 2 ký tự.");
        if (name.Length > 200)
            throw new ProductValidationException("Tên thương hiệu tối đa 200 ký tự.");

        if (await _brandRepository.ExistsNameAsync(name, excludeId: id))
            throw new ProductValidationException($"Thương hiệu '{name}' đã tồn tại.");

        brand.Name = name;
        if (request.IsActive.HasValue)
            brand.IsActive = request.IsActive.Value;
        brand.UpdatedAt = DateTime.UtcNow;

        var updated = await _brandRepository.UpdateAsync(brand);
        return MapToResponse(updated);
    }

    public async Task DeleteAsync(int id)
    {
        var brand = await _brandRepository.GetByIdAsync(id)
            ?? throw new BrandNotFoundException(id);
        if (brand.IsDeleted)
            throw new ProductValidationException("Thương hiệu đã được xóa.");
        await _brandRepository.DeleteAsync(brand);
    }

    public async Task<BrandResponse> RestoreAsync(int id)
    {
        var brand = await _brandRepository.GetByIdAsync(id, includeDeleted: true)
            ?? throw new BrandNotFoundException(id);
        if (!brand.IsDeleted)
            throw new ProductValidationException("Thương hiệu chưa bị xóa.");

        if (await _brandRepository.ExistsNameAsync(brand.Name, excludeId: id, includeDeleted: false))
            throw new ProductValidationException(
                $"Không thể kích hoạt lại — đã có thương hiệu khác tên '{brand.Name}'.");

        await _brandRepository.RestoreAsync(brand);
        return MapToResponse((await _brandRepository.GetByIdAsync(id))!);
    }

    private static BrandResponse MapToResponse(Brand b) =>
        new(b.Id, b.Name, b.IsActive, b.IsDeleted, b.CreatedAt, b.UpdatedAt);
}
