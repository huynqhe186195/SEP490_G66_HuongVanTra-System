using Microsoft.EntityFrameworkCore;
using ProductService.Application.Interfaces;
using ProductService.Domain.Entities;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.Repositories;

public class PriceBookRepository(ProductDbContext _db) : IPriceBookRepository
{
    public async Task<(List<PriceBook> Items, int TotalCount)> GetPagedAsync(
        string? search,
        bool? isActive,
        int page,
        int pageSize)
    {
        var query = IncludeEntries(_db.PriceBooks);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(p =>
                p.Code.ToLower().Contains(s) ||
                p.Name.ToLower().Contains(s) ||
                (p.Description != null && p.Description.ToLower().Contains(s)));
        }

        if (isActive.HasValue)
            query = query.Where(p => p.IsActive == isActive.Value);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<PriceBook?> GetByIdAsync(Guid id, bool includeDeleted = false)
    {
        var query = includeDeleted
            ? IncludeEntries(_db.PriceBooks.IgnoreQueryFilters())
            : IncludeEntries(_db.PriceBooks);
        return await query.FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<bool> ExistsCodeAsync(string code, Guid? excludeId = null)
    {
        var normalized = code.Trim().ToUpperInvariant();
        var query = _db.PriceBooks.Where(p => p.Code == normalized);
        if (excludeId.HasValue) query = query.Where(p => p.Id != excludeId.Value);
        return await query.AnyAsync();
    }

    public async Task<PriceBook> CreateAsync(PriceBook priceBook)
    {
        _db.PriceBooks.Add(priceBook);
        await _db.SaveChangesAsync();
        return (await GetByIdAsync(priceBook.Id))!;
    }

    public async Task<PriceBook> UpdateAsync(PriceBook priceBook)
    {
        _db.PriceBooks.Update(priceBook);
        await _db.SaveChangesAsync();
        return (await GetByIdAsync(priceBook.Id))!;
    }

    public async Task DeleteAsync(PriceBook priceBook)
    {
        priceBook.IsDeleted = true;
        priceBook.IsActive = false;
        priceBook.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    private static IQueryable<PriceBook> IncludeEntries(IQueryable<PriceBook> query) =>
        query.Include(p => p.Entries);
}
