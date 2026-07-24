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

    public Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default) =>
        _db.SupplierReceipts.CountAsync(r => r.CreatedAt >= sinceUtc, ct);

    public Task<int> CountBySupplerIdAsync(Guid supplierId, CancellationToken ct = default) =>
        _db.SupplierReceipts.CountAsync(r => r.SupplierId == supplierId, ct);

    public async Task AddAsync(SupplierReceipt receipt, CancellationToken ct = default) =>
        await _db.SupplierReceipts.AddAsync(receipt, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
