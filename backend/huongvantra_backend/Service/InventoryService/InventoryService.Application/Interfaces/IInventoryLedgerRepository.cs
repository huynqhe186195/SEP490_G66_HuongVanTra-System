using InventoryService.Domain.Entities;

namespace InventoryService.Application.Interfaces;

public interface IInventoryLedgerRepository
{
    Task<(List<InventoryLedgerEntry> Items, int TotalCount)> GetPagedAsync(
        string? search,
        Guid? skuId,
        string? location,
        string? transactionType,
        string? referenceCode,
        Guid? actorId,
        DateTime? fromUtc,
        DateTime? toUtc,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task AddRangeAsync(IEnumerable<InventoryLedgerEntry> entries, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
