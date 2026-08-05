using InventoryService.Domain.Entities;

namespace InventoryService.Application.Interfaces;

public interface IStockExportSlipRepository
{
    Task<StockExportSlip?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<StockExportSlip?> GetByReferenceAsync(
        string referenceType,
        Guid referenceId,
        string exportType,
        CancellationToken ct = default);
    Task<List<StockExportSlip>> GetListAsync(string? search, CancellationToken ct = default);
    Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default);
    Task AddAsync(StockExportSlip slip, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
