using InventoryService.Domain.Entities;

namespace InventoryService.Application.Interfaces;

public interface IWarehouseDailyReportSubmissionRepository
{
    Task AddAsync(WarehouseDailyReportSubmission entity, CancellationToken ct = default);
    Task<WarehouseDailyReportSubmission?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> ExistsByBusinessDateAsync(DateOnly businessDate, CancellationToken ct = default);
    Task<(IReadOnlyList<WarehouseDailyReportSubmission> Items, int Total)> GetPagedAsync(
        DateOnly? businessDateFrom,
        DateOnly? businessDateTo,
        string? sentByName,
        int page,
        int pageSize,
        CancellationToken ct = default);
}
