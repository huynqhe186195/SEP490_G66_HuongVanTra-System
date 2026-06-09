using Microsoft.EntityFrameworkCore;
using ProductService.Application.Interfaces;
using ProductService.Domain.Entities;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.Repositories;

public class CategoryRepository(ProductDbContext _db) : ICategoryRepository
{
    public async Task<List<Category>> GetAllAsync(bool? isDeleted = null)
    {
        IQueryable<Category> query = isDeleted == true
            ? _db.Categories.IgnoreQueryFilters().Where(c => c.IsDeleted)
            : _db.Categories.AsQueryable();

        if (isDeleted == false)
            query = query.Where(c => !c.IsDeleted);

        return await query.OrderBy(c => c.Name).ToListAsync();
    }

    public async Task<Category?> GetByIdAsync(int id, bool includeDeleted = false)
    {
        var query = includeDeleted
            ? _db.Categories.IgnoreQueryFilters()
            : _db.Categories.AsQueryable();

        return await query.FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<bool> ExistsNameAsync(string name, int? excludeId = null, bool includeDeleted = true)
    {
        var normalized = name.Trim().ToLower();
        IQueryable<Category> query = includeDeleted
            ? _db.Categories.IgnoreQueryFilters()
            : _db.Categories;

        query = query.Where(c => c.Name.ToLower() == normalized);
        if (excludeId.HasValue)
            query = query.Where(c => c.Id != excludeId.Value);

        return await query.AnyAsync();
    }

    public async Task<Category> CreateAsync(Category category)
    {
        _db.Categories.Add(category);
        await _db.SaveChangesAsync();
        return category;
    }

    public async Task<Category> UpdateAsync(Category category)
    {
        _db.Categories.Update(category);
        await _db.SaveChangesAsync();
        return category;
    }

    public async Task DeleteAsync(Category category)
    {
        category.IsDeleted = true;
        category.IsActive = false;
        category.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task RestoreAsync(Category category)
    {
        category.IsDeleted = false;
        category.IsActive = true;
        category.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }
}
