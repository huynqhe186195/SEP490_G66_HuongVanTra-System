using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class SupplierReceiptRepository(InventoryDbContext _db) : ISupplierReceiptRepository
{
    private IQueryable<SupplierReceipt> WithItems() =>
        _db.SupplierReceipts.Include(r => r.Items);

    public Task<SupplierReceipt?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        WithItems().FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task<SupplierReceiptApprovalContext?> GetApprovalContextAsync(
        Guid id,
        CancellationToken ct = default)
    {
        var header = await _db.SupplierReceipts
            .AsNoTracking()
            .Where(receipt => receipt.Id == id)
            .Select(receipt => new { receipt.Status, receipt.CreatedBy })
            .FirstOrDefaultAsync(ct);
        if (header is null)
            return null;

        var skuIds = await _db.SupplierReceiptItems
            .AsNoTracking()
            .Where(item => item.SupplierReceiptId == id)
            .OrderBy(item => item.SkuCode)
            .Select(item => item.SkuId)
            .ToListAsync(ct);

        return new SupplierReceiptApprovalContext(header.Status, header.CreatedBy, skuIds);
    }

    public async Task<(List<SupplierReceipt> Items, int TotalCount)> GetPagedAsync(
        SupplierReceiptStatus? status,
        Guid? createdBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = WithItems().AsNoTracking().AsQueryable();

        if (status.HasValue)
            query = query.Where(r => r.Status == status.Value);
        if (createdBy.HasValue)
            query = query.Where(r => r.CreatedBy == createdBy.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(r =>
                r.ReceiptCode.ToLower().Contains(keyword) ||
                (r.SupplierName != null && r.SupplierName.ToLower().Contains(keyword)) ||
                (r.SupplierReference != null && r.SupplierReference.ToLower().Contains(keyword)) ||
                (r.SupplierDocumentNumber != null && r.SupplierDocumentNumber.ToLower().Contains(keyword)) ||
                (r.StockImportSlipCode != null && r.StockImportSlipCode.ToLower().Contains(keyword)) ||
                r.Items.Any(i =>
                    i.SkuCode.ToLower().Contains(keyword) ||
                    i.SkuNameSnapshot.ToLower().Contains(keyword) ||
                    i.LotCode.ToLower().Contains(keyword)));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<Dictionary<string, int>> CountByStatusAsync(
        Guid? createdBy,
        string? search,
        CancellationToken ct = default)
    {
        var query = WithItems().AsNoTracking().AsQueryable();
        if (createdBy.HasValue)
            query = query.Where(r => r.CreatedBy == createdBy.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(r =>
                r.ReceiptCode.ToLower().Contains(keyword) ||
                (r.SupplierName != null && r.SupplierName.ToLower().Contains(keyword)) ||
                (r.SupplierReference != null && r.SupplierReference.ToLower().Contains(keyword)) ||
                (r.SupplierDocumentNumber != null && r.SupplierDocumentNumber.ToLower().Contains(keyword)) ||
                (r.StockImportSlipCode != null && r.StockImportSlipCode.ToLower().Contains(keyword)) ||
                r.Items.Any(i =>
                    i.SkuCode.ToLower().Contains(keyword) ||
                    i.SkuNameSnapshot.ToLower().Contains(keyword) ||
                    i.LotCode.ToLower().Contains(keyword)));
        }

        var rows = await query
            .GroupBy(r => r.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToListAsync(ct);
        return rows.ToDictionary(
            row => row.Status.ToString().ToLowerInvariant(),
            row => row.Count,
            StringComparer.OrdinalIgnoreCase);
    }

    public Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default) =>
        _db.SupplierReceipts.CountAsync(r => r.CreatedAt >= sinceUtc, ct);

    public async Task<SupplierReceiptStats> GetStatsBySupplierIdAsync(Guid supplierId, CancellationToken ct = default)
    {
        var stats = await _db.SupplierReceipts
            .AsNoTracking()
            .Where(r => r.SupplierId == supplierId && r.Status == SupplierReceiptStatus.Completed)
            .GroupBy(_ => 1)
            .Select(g => new { Count = g.Count(), TotalValue = g.Sum(r => r.TotalAmount) })
            .FirstOrDefaultAsync(ct);

        return stats is null
            ? new SupplierReceiptStats(0, 0m)
            : new SupplierReceiptStats(stats.Count, stats.TotalValue);
    }

    public Task<SupplierReceipt?> FindDuplicateDocumentAsync(Guid? supplierId, string? supplierDocumentNumber, Guid? excludeId, CancellationToken ct = default)
    {
        if (supplierId == null || string.IsNullOrWhiteSpace(supplierDocumentNumber))
            return Task.FromResult<SupplierReceipt?>(null);
        var normalized = supplierDocumentNumber.Trim();
        return _db.SupplierReceipts
            .Where(r => r.SupplierId == supplierId
                && r.SupplierDocumentNumber == normalized
                && r.Status == SupplierReceiptStatus.Completed
                && (excludeId == null || r.Id != excludeId))
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(ct);
    }

    public async Task AddAsync(SupplierReceipt receipt, CancellationToken ct = default) =>
        await _db.SupplierReceipts.AddAsync(receipt, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
