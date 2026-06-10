using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.Interfaces;

public interface IStockAdjustmentRequestRepository
{
    Task<StockAdjustmentRequest?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<StockAdjustmentRequest>> GetListAsync(
        StockAdjustmentRequestStatus? status,
        Guid? requestedBy,
        string? search,
        CancellationToken ct = default);
    Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default);
    Task AddAsync(StockAdjustmentRequest request, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
