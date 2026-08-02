using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.Interfaces;

public interface ISupplierReturnRequestRepository
{
    Task<SupplierReturnRequest?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<SupplierReturnRequest?> GetByOperationIdAsync(Guid operationId, CancellationToken ct = default);
    Task<(List<SupplierReturnRequest> Items, int TotalCount)> GetPagedAsync(
        InventoryReturnRequestStatus? status,
        Guid? createdBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default);
    Task AddAsync(SupplierReturnRequest request, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
