using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class StockAdjustmentRequestRepository(InventoryDbContext _db) : IStockAdjustmentRequestRepository
{
    public Task<StockAdjustmentRequest?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.StockAdjustmentRequests
            .Include(r => r.Items)
            .ThenInclude(i => i.ExportSlip)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task<List<StockAdjustmentRequest>> GetListAsync(
        StockAdjustmentRequestStatus? status,
        Guid? requestedBy,
        string? search,
        CancellationToken ct = default)
    {
        var query = BuildListQuery(status, false, requestedBy, search);

        return await query
            .Include(r => r.Items)
            .ThenInclude(i => i.ExportSlip)
            .OrderByDescending(r => r.RequestedAt)
            .ToListAsync(ct);
    }

    public async Task<(List<StockAdjustmentRequest> Items, int TotalCount)> GetPagedAsync(
        StockAdjustmentRequestStatus? status,
        bool excludePending,
        Guid? requestedBy,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default,
        string? creatorRole = null,
        DateTime? fromDateUtc = null,
        DateTime? toDateUtc = null,
        bool onlyRemaining = false,
        string? sort = null)
    {
        var query = BuildListQuery(status, excludePending, requestedBy, search, creatorRole, fromDateUtc, toDateUtc);

        if (onlyRemaining)
        {
            // Còn thiếu = còn ít nhất một dòng chưa kết thúc và chưa giao đủ.
            query = query.Where(r => r.Items.Any(i =>
                i.Status != StockAdjustmentRequestItemStatus.Fulfilled &&
                i.Status != StockAdjustmentRequestItemStatus.Rejected &&
                i.Status != StockAdjustmentRequestItemStatus.ClosedPartial &&
                i.Status != StockAdjustmentRequestItemStatus.Cancelled &&
                i.QuantityDelta - i.FulfilledQuantity - i.RejectedQuantity > 0));
        }

        var totalCount = await query.CountAsync(ct);
        var items = await ApplySort(query, sort)
            .Include(r => r.Items)
            .ThenInclude(i => i.ExportSlip)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task<Dictionary<string, int>> CountQuickFiltersAsync(
        Guid? requestedBy,
        string? search,
        string? creatorRole = null,
        DateTime? fromDateUtc = null,
        DateTime? toDateUtc = null,
        CancellationToken ct = default)
    {
        var query = BuildListQuery(null, false, requestedBy, search, creatorRole, fromDateUtc, toDateUtc);
        var byStatus = await query
            .GroupBy(request => request.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToListAsync(ct);

        var counts = byStatus.ToDictionary(row => row.Status, row => row.Count);
        var total = counts.Values.Sum();
        var pending = counts.GetValueOrDefault(StockAdjustmentRequestStatus.Pending);
        var processing = counts.GetValueOrDefault(StockAdjustmentRequestStatus.Processing);
        var remaining = await query.CountAsync(request => request.Items.Any(item =>
            item.Status != StockAdjustmentRequestItemStatus.Fulfilled &&
            item.Status != StockAdjustmentRequestItemStatus.Rejected &&
            item.Status != StockAdjustmentRequestItemStatus.ClosedPartial &&
            item.Status != StockAdjustmentRequestItemStatus.Cancelled &&
            item.QuantityDelta - item.FulfilledQuantity - item.RejectedQuantity > 0), ct);

        return new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["all"] = total,
            ["pending"] = pending,
            ["processing"] = processing,
            ["remaining"] = remaining,
            ["processed"] = total - pending,
        };
    }

    /// <summary>
    /// Thứ tự ưu tiên xử lý của Thủ kho: Chờ tiếp nhận → Đang xử lý → Đã bổ sung một phần →
    /// Chờ bổ sung tồn Kho → các trạng thái đã kết thúc; cùng nhóm thì cũ trước.
    /// </summary>
    private static IQueryable<StockAdjustmentRequest> ApplySort(
        IQueryable<StockAdjustmentRequest> query,
        string? sort) => (sort ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "oldest" => query.OrderBy(r => r.RequestedAt),
            "code_asc" => query.OrderBy(r => r.RequestCode),
            "code_desc" => query.OrderByDescending(r => r.RequestCode),
            "status" => query.OrderBy(r => r.Status).ThenByDescending(r => r.RequestedAt),
            "warehouse_priority" => query
                .OrderBy(r =>
                    r.Status == StockAdjustmentRequestStatus.Pending ? 0
                    : r.Status == StockAdjustmentRequestStatus.Approved
                        || r.Status == StockAdjustmentRequestStatus.Processing ? 1
                    : r.Status == StockAdjustmentRequestStatus.PartiallyFulfilled ? 2
                    : r.Status == StockAdjustmentRequestStatus.Draft ? 3
                    : 4)
                .ThenBy(r => r.RequestedAt),
            _ => query.OrderByDescending(r => r.RequestedAt),
        };

    public async Task<List<string>> GetCreatorRolesAsync(CancellationToken ct = default) =>
        await _db.StockAdjustmentRequests
            .AsNoTracking()
            .Where(r => r.RequestedByRoleName != null && r.RequestedByRoleName != "")
            .Select(r => r.RequestedByRoleName!)
            .Distinct()
            .OrderBy(role => role)
            .ToListAsync(ct);

    public async Task<List<(Guid Id, string? Name, string? RoleName)>> GetCreatorsAsync(
        CancellationToken ct = default)
    {
        var rows = await _db.StockAdjustmentRequests
            .AsNoTracking()
            .GroupBy(r => r.RequestedBy)
            .Select(g => new
            {
                Id = g.Key,
                // Yêu cầu mới nhất giữ tên và vai trò gần đúng nhất với hiện tại.
                Name = g.OrderByDescending(r => r.RequestedAt).Select(r => r.RequestedByName).First(),
                RoleName = g.OrderByDescending(r => r.RequestedAt).Select(r => r.RequestedByRoleName).First(),
            })
            .ToListAsync(ct);

        return rows
            .Select(row => (row.Id, row.Name, row.RoleName))
            .OrderBy(row => row.Name ?? string.Empty)
            .ToList();
    }

    private IQueryable<StockAdjustmentRequest> BuildListQuery(
        StockAdjustmentRequestStatus? status,
        bool excludePending,
        Guid? requestedBy,
        string? search,
        string? creatorRole = null,
        DateTime? fromDateUtc = null,
        DateTime? toDateUtc = null)
    {
        var query = _db.StockAdjustmentRequests.AsQueryable();

        if (status.HasValue)
            query = query.Where(r => r.Status == status.Value);

        if (excludePending)
            query = query.Where(r => r.Status != StockAdjustmentRequestStatus.Pending);

        if (requestedBy.HasValue)
            query = query.Where(r => r.RequestedBy == requestedBy.Value);

        if (!string.IsNullOrWhiteSpace(creatorRole))
        {
            var role = creatorRole.Trim().ToLower();
            query = query.Where(r => r.RequestedByRoleName != null && r.RequestedByRoleName.ToLower() == role);
        }

        if (fromDateUtc.HasValue)
            query = query.Where(r => r.RequestedAt >= fromDateUtc.Value);

        if (toDateUtc.HasValue)
            query = query.Where(r => r.RequestedAt < toDateUtc.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(r =>
                r.RequestCode.ToLower().Contains(keyword) ||
                r.Items.Any(i =>
                    i.SkuCode.ToLower().Contains(keyword) ||
                    i.SkuSnapshotName.ToLower().Contains(keyword)));
        }

        return query;
    }

    public Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default) =>
        _db.StockAdjustmentRequests.CountAsync(r => r.RequestedAt >= sinceUtc, ct);

    public async Task<List<StockAdjustmentRequestItem>> GetOpenItemsBySkuIdsAsync(
        IEnumerable<Guid> skuIds,
        CancellationToken ct = default)
    {
        var ids = skuIds.Distinct().ToList();
        if (ids.Count == 0) return [];

        // Dòng đang mở = chưa Fulfilled/Rejected/ClosedPartial/Cancelled, và phiếu cha cũng chưa kết thúc.
        return await _db.StockAdjustmentRequestItems
            .AsNoTracking()
            .Include(i => i.Request)
            .Where(i => ids.Contains(i.SkuId)
                && i.Status != StockAdjustmentRequestItemStatus.Fulfilled
                && i.Status != StockAdjustmentRequestItemStatus.Rejected
                && i.Status != StockAdjustmentRequestItemStatus.ClosedPartial
                && i.Status != StockAdjustmentRequestItemStatus.Cancelled
                && i.Request!.Status != StockAdjustmentRequestStatus.Cancelled
                && i.Request.Status != StockAdjustmentRequestStatus.Rejected
                && i.Request.Status != StockAdjustmentRequestStatus.Fulfilled
                && i.Request.Status != StockAdjustmentRequestStatus.ClosedPartial
                && i.Request.Status != StockAdjustmentRequestStatus.Completed)
            .OrderBy(i => i.Request!.RequestedAt)
            .ToListAsync(ct);
    }

    public Task<List<StockTransfer>> GetTransfersBySourceRequestAsync(Guid requestId, CancellationToken ct = default) =>
        _db.StockTransfers
            .AsNoTracking()
            .Include(t => t.Lines)
            .Where(t => t.SourceRequestId == requestId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

    public async Task<Dictionary<Guid, int>> GetDraftReservedQuantitiesAsync(
        IEnumerable<Guid> requestIds,
        CancellationToken ct = default)
    {
        var ids = requestIds.Distinct().ToList();
        if (ids.Count == 0) return new Dictionary<Guid, int>();

        var rows = await _db.StockTransferLines
            .AsNoTracking()
            .Where(line => line.SourceRequestLineId != null
                && line.StockTransfer!.SourceRequestId != null
                && ids.Contains(line.StockTransfer.SourceRequestId!.Value)
                && line.StockTransfer.Status == StockTransferStatus.Draft)
            .GroupBy(line => line.SourceRequestLineId!.Value)
            .Select(g => new { SourceRequestLineId = g.Key, Quantity = g.Sum(line => line.Quantity) })
            .ToListAsync(ct);

        return rows.ToDictionary(row => row.SourceRequestLineId, row => row.Quantity);
    }

    public async Task AddAsync(StockAdjustmentRequest request, CancellationToken ct = default) =>
        await _db.StockAdjustmentRequests.AddAsync(request, ct);

    public async Task AddWithGeneratedCodeAsync(
        StockAdjustmentRequest request,
        CancellationToken ct = default)
    {
        await _db.StockAdjustmentRequests.AddAsync(request, ct);

        // Mã sinh từ số lượng phiếu trong ngày nên hai người gửi cùng lúc có thể ra cùng mã.
        // RequestCode có unique index, nên bắt lỗi trùng và sinh lại thay vì để vỡ ra tầng trên.
        const int maxAttempts = 5;
        for (var attempt = 0; ; attempt++)
        {
            var today = request.RequestedAt.Date;
            var countToday = await _db.StockAdjustmentRequests
                .CountAsync(r => r.RequestedAt >= today && r.Id != request.Id, ct);
            request.RequestCode = $"YC-{today:yyyyMMdd}-{(countToday + 1 + attempt):D4}";

            try
            {
                await _db.SaveChangesAsync(ct);
                return;
            }
            catch (DbUpdateException) when (attempt < maxAttempts - 1)
            {
                // SaveChanges thất bại nên EF giữ nguyên trạng thái Added của cả phiếu lẫn các dòng;
                // chỉ cần sinh lại mã rồi lưu lại.
            }
        }
    }

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
