using InventoryService.Domain.Entities;

namespace InventoryService.Application.Interfaces;

public interface IStockImportSlipRepository
{
    Task<StockImportSlip?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<StockImportSlip>> GetListAsync(string? search, CancellationToken ct = default);
    Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default);
    Task AddAsync(StockImportSlip slip, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
