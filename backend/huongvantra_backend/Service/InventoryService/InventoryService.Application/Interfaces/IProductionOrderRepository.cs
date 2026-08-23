using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;

namespace InventoryService.Application.Interfaces;

public interface IProductionOrderRepository
{
    Task<ProductionOrder?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<ProductionOrder?> GetBySourceRequestItemIdAsync(Guid requestItemId, CancellationToken ct = default);
    Task<(List<ProductionOrder> Items, int Total)> GetPagedAsync(
        ProductionOrderStatus? status, int page, int pageSize, CancellationToken ct = default);
    Task<Dictionary<string, int>> CountByStatusAsync(CancellationToken ct = default);
    Task<int> CountCreatedSinceAsync(DateTime since, CancellationToken ct = default);
    Task AddAsync(ProductionOrder order, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
