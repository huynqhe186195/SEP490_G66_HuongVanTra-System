using Microsoft.EntityFrameworkCore;
using ProductService.Application.Interfaces;
using ProductService.Domain.Entities;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.Repositories;

public class ProductRepository(ProductDbContext _db) : IProductRepository
{
    public async Task<(List<Product> Items, int TotalCount)> GetPagedAsync(
        string? search, int? categoryId, bool? isActive, bool? isDeleted,
        int page, int pageSize)
    {
        IQueryable<Product> query = isDeleted == true
            ? _db.Products.IgnoreQueryFilters().Include(p => p.Category).Include(p => p.Skus)
            : _db.Products.Include(p => p.Category).Include(p => p.Skus);

        if (isDeleted == true)
            query = query.Where(p => p.IsDeleted);
        else if (isDeleted == false)
            query = query.Where(p => !p.IsDeleted);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(p =>
                p.Name.ToLower().Contains(s) ||
                (p.Origin != null && p.Origin.ToLower().Contains(s)) ||
                (p.Description != null && p.Description.ToLower().Contains(s)));
        }

        if (categoryId.HasValue)
            query = query.Where(p => p.CategoryId == categoryId.Value);

        if (isDeleted != true && isActive.HasValue)
            query = query.Where(p => p.IsActive == isActive.Value);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<List<Product>> GetAllAsync(bool includeInactive = false)
    {
        var query = _db.Products.Include(p => p.Category).Include(p => p.Skus).AsQueryable();
        if (!includeInactive) query = query.Where(p => p.IsActive);
        return await query.OrderBy(p => p.Name).ToListAsync();
    }

    public async Task<bool> ExistsNameAsync(string name, Guid? excludeProductId = null, bool includeDeleted = true)
    {
        var normalized = name.Trim().ToLower();
        IQueryable<Product> query = includeDeleted
            ? _db.Products.IgnoreQueryFilters()
            : _db.Products;

        query = query.Where(p => p.Name.ToLower() == normalized);
        if (excludeProductId.HasValue)
            query = query.Where(p => p.Id != excludeProductId.Value);

        return await query.AnyAsync();
    }

    public async Task<Product?> GetByIdAsync(Guid id, bool includeDeleted = false)
    {
        var query = includeDeleted
            ? _db.Products.IgnoreQueryFilters()
            : _db.Products.AsQueryable();

        return await query.Include(p => p.Category).Include(p => p.Skus)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<Product> CreateAsync(Product product)
    {
        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        return (await GetByIdAsync(product.Id))!;
    }

    public async Task<Product> UpdateAsync(Product product)
    {
        _db.Products.Update(product);
        await _db.SaveChangesAsync();
        return (await GetByIdAsync(product.Id, includeDeleted: true))!;
    }

    public async Task DeleteAsync(Product product)
    {
        product.IsDeleted = true;
        product.IsActive = false;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task RestoreAsync(Product product)
    {
        product.IsDeleted = false;
        product.IsActive = true;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }
}
