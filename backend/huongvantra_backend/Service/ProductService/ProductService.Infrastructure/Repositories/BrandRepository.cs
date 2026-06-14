using Microsoft.EntityFrameworkCore;
using ProductService.Application.Interfaces;
using ProductService.Domain.Entities;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.Repositories;

public class BrandRepository(ProductDbContext _db) : IBrandRepository
{
    public async Task<List<Brand>> GetAllAsync(bool? isDeleted = null)
    {
        IQueryable<Brand> query = isDeleted == true
            ? _db.Brands.IgnoreQueryFilters().Where(b => b.IsDeleted)
            : _db.Brands.AsQueryable();

        if (isDeleted == false)
            query = query.Where(b => !b.IsDeleted);

        return await query.OrderBy(b => b.Name).ToListAsync();
    }

    public async Task<Brand?> GetByIdAsync(int id, bool includeDeleted = false)
    {
        var query = includeDeleted
            ? _db.Brands.IgnoreQueryFilters()
            : _db.Brands.AsQueryable();

        return await query.FirstOrDefaultAsync(b => b.Id == id);
    }

    public async Task<bool> ExistsNameAsync(string name, int? excludeId = null, bool includeDeleted = true)
    {
        var normalized = name.Trim().ToLower();
        IQueryable<Brand> query = includeDeleted
            ? _db.Brands.IgnoreQueryFilters()
            : _db.Brands;

        query = query.Where(b => b.Name.ToLower() == normalized);
        if (excludeId.HasValue)
            query = query.Where(b => b.Id != excludeId.Value);

        return await query.AnyAsync();
    }

    public async Task<Brand> CreateAsync(Brand brand)
    {
        _db.Brands.Add(brand);
        await _db.SaveChangesAsync();
        return brand;
    }

    public async Task<Brand> UpdateAsync(Brand brand)
    {
        _db.Brands.Update(brand);
        await _db.SaveChangesAsync();
        return brand;
    }

    public async Task DeleteAsync(Brand brand)
    {
        brand.IsDeleted = true;
        brand.IsActive = false;
        brand.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task RestoreAsync(Brand brand)
    {
        brand.IsDeleted = false;
        brand.IsActive = true;
        brand.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }
}
