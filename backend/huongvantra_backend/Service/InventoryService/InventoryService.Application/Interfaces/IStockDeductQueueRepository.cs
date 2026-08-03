using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.Interfaces;

public interface IStockDeductQueueRepository
{
    Task<StockDeductQueue?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<StockDeductQueue?> GetByOrderIdAsync(Guid orderId, CancellationToken ct = default);
    Task<List<StockDeductQueue>> GetWaitingAsync(string? status, string? search, CancellationToken ct = default);
    Task<List<StockDeductQueue>> GetUnresolvedBomReconciliationQueuesAsync(
        Guid? excludeQueueId = null,
        CancellationToken ct = default);
    Task<int> CountWaitingAsync(CancellationToken ct = default);
    Task<(List<StockDeductQueue> Items, int TotalCount)> GetWaitingPagedAsync(
        string? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<Dictionary<string, int>> CountWaitingByStatusAsync(string? search, CancellationToken ct = default);
    Task AddAsync(StockDeductQueue queue, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);

    /// <summary>
    /// POS-04 (truy vết giữ chỗ): các queue có ít nhất một dòng đang giữ chỗ SKU này.
    /// </summary>
    Task<List<StockDeductQueue>> GetQueuesWithActiveReservationBySkuAsync(
        Guid skuId,
        CancellationToken ct = default);

    /// <summary>
    /// POS-04 (truy vết giữ chỗ): các queue có ít nhất một dòng đang giữ chỗ, mới nhất trước.
    /// </summary>
    Task<(List<StockDeductQueue> Items, int TotalCount)> GetQueuesWithActiveReservationPagedAsync(
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default);

    /// <summary>
    /// POS-04 (truy vết giữ chỗ): OrderId của các đơn đang giữ chỗ, giới hạn theo tập OrderId truyền vào
    /// (rỗng = không giới hạn). Dùng cho badge/filter trên danh sách đơn.
    /// </summary>
    Task<List<Guid>> GetOrderIdsWithActiveReservationAsync(
        IReadOnlyCollection<Guid>? orderIds = null,
        CancellationToken ct = default);
}
