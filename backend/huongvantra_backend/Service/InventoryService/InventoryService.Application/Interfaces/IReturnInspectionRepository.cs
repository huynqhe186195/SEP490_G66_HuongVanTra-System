using InventoryService.Domain.Entities;

namespace InventoryService.Application.Interfaces;

public interface IReturnInspectionRepository
{
    Task<ReturnInspection?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<ReturnInspection>> GetByReturnIdAsync(Guid returnId, CancellationToken ct = default);
    Task<(List<ReturnInspection> Items, int TotalCount)> GetPagedAsync(
        string? disposition, string? search, int page, int pageSize, CancellationToken ct = default);
    Task<bool> ExistsByReturnAndSkuAsync(Guid returnId, Guid skuId, CancellationToken ct = default);
    Task AddAsync(ReturnInspection inspection, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
