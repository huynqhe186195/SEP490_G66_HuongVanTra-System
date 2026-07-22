using Microsoft.EntityFrameworkCore;
using ProductService.Application.Validation;
using ProductService.Application.Interfaces;
using ProductService.Domain.Entities;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.Repositories;

public class AttributeNameRepository(ProductDbContext _db) : IAttributeNameRepository
{
    public async Task<List<AttributeName>> GetAllAsync(bool? isDeleted = null)
    {
        IQueryable<AttributeName> query = isDeleted == true
            ? _db.AttributeNames.IgnoreQueryFilters().Where(a => a.IsDeleted)
            : _db.AttributeNames.AsQueryable();

        if (isDeleted == false)
            query = query.Where(a => !a.IsDeleted);

        return await query.OrderBy(a => a.Name).ToListAsync();
    }

    public async Task<AttributeName?> GetByIdAsync(int id, bool includeDeleted = false)
    {
        var query = includeDeleted
            ? _db.AttributeNames.IgnoreQueryFilters()
            : _db.AttributeNames.AsQueryable();

        return await query.FirstOrDefaultAsync(a => a.Id == id);
    }

    public async Task<bool> ExistsNameAsync(string name, int? excludeId = null, bool includeDeleted = true)
    {
        var normalized = ProductInputValidator.NormalizeAttributeNameKey(name);
        if (normalized is null) return false;

        IQueryable<AttributeName> query = includeDeleted
            ? _db.AttributeNames.IgnoreQueryFilters()
            : _db.AttributeNames;

        if (excludeId.HasValue)
            query = query.Where(a => a.Id != excludeId.Value);

        var names = await query.Select(a => a.Name).ToListAsync();
        return names.Any(existing => ProductInputValidator.NormalizeAttributeNameKey(existing) == normalized);
    }

    public async Task<AttributeName> CreateAsync(AttributeName attributeName)
    {
        _db.AttributeNames.Add(attributeName);
        await _db.SaveChangesAsync();
        return attributeName;
    }

    public async Task<AttributeName> UpdateAsync(AttributeName attributeName)
    {
        _db.AttributeNames.Update(attributeName);
        await _db.SaveChangesAsync();
        return attributeName;
    }

    public async Task DeleteAsync(AttributeName attributeName)
    {
        attributeName.IsDeleted = true;
        attributeName.IsActive = false;
        attributeName.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task RestoreAsync(AttributeName attributeName)
    {
        attributeName.IsDeleted = false;
        attributeName.IsActive = true;
        attributeName.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }
}
