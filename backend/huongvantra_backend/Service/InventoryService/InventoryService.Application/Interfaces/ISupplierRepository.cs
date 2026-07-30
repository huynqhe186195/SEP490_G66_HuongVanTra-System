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
    Task<bool> NormalizedCodeExistsAsync(
        string normalizedCode,
        Guid? excludeSupplierId = null,
        CancellationToken ct = default);
    /// <summary>
    /// Sinh mã NCC-###### kế tiếp cho supplier rồi lưu. Unique index là chốt chặn cuối:
    /// khi hai request đồng thời cùng lấy một số thứ tự, request thua được retry số kế tiếp.
    /// </summary>
    Task AddWithGeneratedCodeAsync(Supplier supplier, CancellationToken ct = default);
    Task AddAsync(Supplier supplier, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
