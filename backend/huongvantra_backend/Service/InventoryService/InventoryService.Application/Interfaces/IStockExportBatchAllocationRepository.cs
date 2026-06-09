using InventoryService.Domain.Entities;

namespace InventoryService.Application.Interfaces;

public interface IStockExportBatchAllocationRepository
{
    Task<List<StockExportBatchAllocation>> GetByExportSlipIdAsync(Guid exportSlipId, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<StockExportBatchAllocation> allocations, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
