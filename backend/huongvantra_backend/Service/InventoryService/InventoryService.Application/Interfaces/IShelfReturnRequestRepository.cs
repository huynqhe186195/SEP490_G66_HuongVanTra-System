using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.Interfaces;

public interface IShelfReturnRequestRepository
{
    Task<ShelfReturnRequest?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<(List<ShelfReturnRequest> Items, int TotalCount)> GetPagedAsync(
        InventoryReturnRequestStatus? status,
        Guid? createdBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default);
    Task AddAsync(ShelfReturnRequest request, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
