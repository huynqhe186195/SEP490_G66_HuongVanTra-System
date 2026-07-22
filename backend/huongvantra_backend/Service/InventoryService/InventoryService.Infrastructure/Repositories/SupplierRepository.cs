using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class SupplierRepository(InventoryDbContext _db) : ISupplierRepository
{
    public Task<Supplier?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task<(List<Supplier> Items, int TotalCount)> GetPagedAsync(
        string? search,
        bool includeDeleted,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _db.Suppliers.AsNoTracking().AsQueryable();

        if (!includeDeleted)
            query = query.Where(s => !s.IsDeleted);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(s =>
                s.Name.ToLower().Contains(keyword) ||
                (s.Phone != null && s.Phone.Contains(keyword)) ||
                (s.Email != null && s.Email.ToLower().Contains(keyword)) ||
                (s.Address != null && s.Address.ToLower().Contains(keyword)));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(s => s.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public Task<List<Supplier>> GetActiveListAsync(CancellationToken ct = default) =>
        _db.Suppliers.AsNoTracking()
            .Where(s => !s.IsDeleted)
            .OrderBy(s => s.Name)
            .ToListAsync(ct);

    public async Task AddAsync(Supplier supplier, CancellationToken ct = default) =>
        await _db.Suppliers.AddAsync(supplier, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
