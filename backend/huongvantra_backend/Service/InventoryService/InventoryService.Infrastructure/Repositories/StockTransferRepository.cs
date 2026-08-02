using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class StockTransferRepository(InventoryDbContext _db) : IStockTransferRepository
{
    private IQueryable<StockTransfer> DetailQuery(bool tracking) =>
        (tracking ? _db.StockTransfers : _db.StockTransfers.AsNoTracking())
            .Include(transfer => transfer.Lines)
            .Include(transfer => transfer.BatchAllocations)
            .Include(transfer => transfer.SourceRequest)
            .Include(transfer => transfer.SourceSuggestion)
            .Include(transfer => transfer.ExportSlip)
            .Include(transfer => transfer.ImportSlip);

    public Task<StockTransfer?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        DetailQuery(tracking: false).FirstOrDefaultAsync(transfer => transfer.Id == id, ct);

    public Task<StockTransfer?> GetTrackedByIdAsync(Guid id, CancellationToken ct = default) =>
        DetailQuery(tracking: true).FirstOrDefaultAsync(transfer => transfer.Id == id, ct);

    public async Task<(List<StockTransfer> Items, int TotalCount)> GetPagedAsync(
        StockTransferStatus? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default,
        Guid? sourceRequestId = null,
        string? transferType = null,
        Guid? createdBy = null,
        DateTime? fromDateUtc = null,
        DateTime? toDateUtc = null,
        string? sort = null)
    {
        var query = _db.StockTransfers.AsNoTracking().AsQueryable();

        if (status.HasValue)
            query = query.Where(transfer => transfer.Status == status.Value);

        if (sourceRequestId.HasValue)
            query = query.Where(transfer => transfer.SourceRequestId == sourceRequestId.Value);

        // Loại phiếu: "fromrequest" có yêu cầu nguồn, "direct" thì không.
        var normalizedType = (transferType ?? string.Empty).Trim().ToLowerInvariant();
        if (normalizedType == "fromrequest")
            query = query.Where(transfer => transfer.SourceRequestId != null);
        else if (normalizedType == "direct")
            query = query.Where(transfer => transfer.SourceRequestId == null);

        if (createdBy.HasValue && createdBy.Value != Guid.Empty)
            query = query.Where(transfer => transfer.CreatedBy == createdBy.Value);

        if (fromDateUtc.HasValue)
            query = query.Where(transfer => transfer.CreatedAt >= fromDateUtc.Value);

        if (toDateUtc.HasValue)
            query = query.Where(transfer => transfer.CreatedAt < toDateUtc.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(transfer =>
                transfer.TransferCode.ToLower().Contains(keyword)
                || (transfer.Note != null && transfer.Note.ToLower().Contains(keyword))
                || (transfer.CreatedByName != null && transfer.CreatedByName.ToLower().Contains(keyword))
                || (transfer.SourceRequest != null
                    && transfer.SourceRequest.RequestCode.ToLower().Contains(keyword))
                || transfer.Lines.Any(line =>
                    line.SkuCode.ToLower().Contains(keyword)
                    || line.SkuNameSnapshot.ToLower().Contains(keyword)));
        }

        var totalCount = await query.CountAsync(ct);
        var items = await ApplySort(query, sort)
            .Include(transfer => transfer.Lines)
            .Include(transfer => transfer.SourceRequest)
            .Include(transfer => transfer.SourceSuggestion)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
        return (items, totalCount);
    }

    private static IQueryable<StockTransfer> ApplySort(
        IQueryable<StockTransfer> query,
        string? sort) => (sort ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "oldest" => query.OrderBy(t => t.CreatedAt).ThenBy(t => t.Id),
            "code_asc" => query.OrderBy(t => t.TransferCode),
            "code_desc" => query.OrderByDescending(t => t.TransferCode),
            "status" => query.OrderBy(t => t.Status).ThenByDescending(t => t.CreatedAt),
            _ => query.OrderByDescending(t => t.CreatedAt).ThenByDescending(t => t.Id),
        };

    public async Task<bool> TryLockDraftForUpdateAsync(
        Guid id,
        DateTime updatedAt,
        CancellationToken ct = default) =>
        await _db.StockTransfers
            .Where(transfer => transfer.Id == id && transfer.Status == StockTransferStatus.Draft)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(transfer => transfer.UpdatedAt, updatedAt), ct) == 1;

    public async Task<bool> TryClaimDraftForCompletionAsync(
        Guid id,
        DateTime claimedAt,
        CancellationToken ct = default) =>
        await _db.StockTransfers
            .Where(transfer => transfer.Id == id && transfer.Status == StockTransferStatus.Draft)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(transfer => transfer.Status, StockTransferStatus.Completed)
                .SetProperty(transfer => transfer.UpdatedAt, claimedAt), ct) == 1;

    public async Task<bool> TryCancelDraftAsync(
        Guid id,
        Guid cancelledBy,
        DateTime cancelledAt,
        string reason,
        CancellationToken ct = default) =>
        await _db.StockTransfers
            .Where(transfer => transfer.Id == id && transfer.Status == StockTransferStatus.Draft)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(transfer => transfer.Status, StockTransferStatus.Cancelled)
                .SetProperty(transfer => transfer.CancelledBy, cancelledBy)
                .SetProperty(transfer => transfer.CancelledAt, cancelledAt)
                .SetProperty(transfer => transfer.CancellationReason, reason)
                .SetProperty(transfer => transfer.UpdatedAt, cancelledAt), ct) == 1;

    public async Task AddAsync(StockTransfer transfer, CancellationToken ct = default) =>
        await _db.StockTransfers.AddAsync(transfer, ct);

    public async Task AddLinesAsync(
        IEnumerable<StockTransferLine> lines,
        CancellationToken ct = default) =>
        await _db.StockTransferLines.AddRangeAsync(lines, ct);

    public async Task AddBatchAllocationsAsync(
        IEnumerable<StockTransferBatchAllocation> allocations,
        CancellationToken ct = default) =>
        await _db.StockTransferBatchAllocations.AddRangeAsync(allocations, ct);

    public async Task<Dictionary<Guid, int>> GetDraftQuantitiesBySourceRequestAsync(
        Guid sourceRequestId,
        Guid? excludeTransferId,
        CancellationToken ct = default)
    {
        var rows = await _db.StockTransferLines
            .AsNoTracking()
            .Where(line => line.SourceRequestLineId != null
                && line.StockTransfer!.SourceRequestId == sourceRequestId
                && line.StockTransfer.Status == StockTransferStatus.Draft
                && (excludeTransferId == null || line.StockTransferId != excludeTransferId))
            .GroupBy(line => line.SourceRequestLineId!.Value)
            .Select(g => new { SourceRequestLineId = g.Key, Quantity = g.Sum(line => line.Quantity) })
            .ToListAsync(ct);

        return rows.ToDictionary(row => row.SourceRequestLineId, row => row.Quantity);
    }

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
