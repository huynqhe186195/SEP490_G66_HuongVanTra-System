using InventoryService.Domain.Entities;

namespace InventoryService.Application.Interfaces;

public interface ISupplierRepository
{
    Task<Supplier?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<(List<Supplier> Items, int TotalCount)> GetPagedAsync(
        string? search,
        bool includeDeleted,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<List<Supplier>> GetActiveListAsync(CancellationToken ct = default);
    Task AddAsync(Supplier supplier, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
