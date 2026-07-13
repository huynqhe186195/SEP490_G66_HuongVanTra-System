using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.Interfaces;

public interface IStockDeductQueueRepository
{
    Task<StockDeductQueue?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<StockDeductQueue?> GetByOrderIdAsync(Guid orderId, CancellationToken ct = default);
    Task<List<StockDeductQueue>> GetWaitingAsync(string? status, string? search, CancellationToken ct = default);
    Task<int> CountWaitingAsync(CancellationToken ct = default);
    Task<(List<StockDeductQueue> Items, int TotalCount)> GetWaitingPagedAsync(
        string? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task AddAsync(StockDeductQueue queue, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
