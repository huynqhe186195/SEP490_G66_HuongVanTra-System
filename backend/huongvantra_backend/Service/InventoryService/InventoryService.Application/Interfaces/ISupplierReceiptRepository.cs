using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.Interfaces;

public interface ISupplierReceiptRepository
{
    Task<SupplierReceipt?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<(List<SupplierReceipt> Items, int TotalCount)> GetPagedAsync(
        SupplierReceiptStatus? status,
        Guid? createdBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default);
    Task<int> CountBySupplerIdAsync(Guid supplierId, CancellationToken ct = default);
    Task AddAsync(SupplierReceipt receipt, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
