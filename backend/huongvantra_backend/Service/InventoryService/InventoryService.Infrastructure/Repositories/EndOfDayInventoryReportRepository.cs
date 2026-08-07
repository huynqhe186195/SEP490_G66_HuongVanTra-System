using InventoryService.Application.DTOs.Requests;
using InventoryService.Application.DTOs.Responses;
using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

/// <summary>
/// Truy vấn phần Kho/Kệ của Báo cáo cuối ngày. Ba nguyên tắc chi phối file này:
/// <list type="number">
/// <item>Không cộng chung Gram với Piece. Ở đâu có snapshot đơn vị thì tách dòng theo đơn vị;
/// ở đâu source không lưu đơn vị thì trả về trường có hậu tố <c>UnknownUnit</c> và ghi vào
/// <c>DataGaps</c>, không âm thầm gộp.</item>
/// <item>Báo cáo này phủ cả Kho và Kệ. Khác với
/// <see cref="WarehouseDailyReportRepository"/> vốn chỉ lọc <c>Location == "Warehouse"</c>.</item>
/// <item>Khoảng thời gian là nửa mở <c>[FromUtc, ToUtcExclusive)</c>, do controller quy đổi từ
/// ngày làm việc GMT+7. Repository không tự suy diễn múi giờ.</item>
/// </list>
/// Không truy vấn chéo sang hvt_order_db — dữ liệu đơn hàng do OrderService cung cấp qua API riêng.
/// </summary>
public sealed class EndOfDayInventoryReportRepository(InventoryDbContext db)
    : IEndOfDayInventoryReportRepository
{
    private const string LocationWarehouse = "Warehouse";
    private const string LocationShelf = "Shelf";
    private const int MaxPageSize = 200;

    public async Task<EndOfDayInventorySummaryResponse> GetSummaryAsync(
        EndOfDayInventoryFilter filter, CancellationToken ct = default)
    {
        var gaps = new List<string>();

        var ledgerQuery = BuildLedgerQuery(filter);

        // Gộp ở DB theo (vị trí, loại giao dịch, đơn vị tính). Chiều nhập/xuất tách bằng dấu
        // của QuantityDelta để không mất thông tin khi cộng bù trừ.
        var ledgerRaw = await ledgerQuery
            .GroupBy(e => new { e.Location, e.TransactionType, e.InventoryUnitSnapshot })
            .Select(g => new
            {
                g.Key.Location,
                g.Key.TransactionType,
                g.Key.InventoryUnitSnapshot,
                EntryCount = g.Count(),
                QuantityIn = g.Sum(x => x.QuantityDelta > 0 ? x.QuantityDelta : 0),
                QuantityOut = g.Sum(x => x.QuantityDelta < 0 ? -x.QuantityDelta : 0)
            })
            .ToListAsync(ct);

        var ledgerByLocationAndType = ledgerRaw
            .GroupBy(r => new { r.Location, r.TransactionType })
            .Select(g => new EndOfDayInventoryLedgerRowDto(
                g.Key.Location,
                LocationLabel(g.Key.Location),
                g.Key.TransactionType,
                g.Sum(x => x.EntryCount),
                g.Select(x => new EndOfDayInventoryUnitFlowDto(
                        NormalizeUnit(x.InventoryUnitSnapshot),
                        UnitLabel(NormalizeUnit(x.InventoryUnitSnapshot)),
                        x.QuantityIn,
                        x.QuantityOut,
                        x.QuantityIn - x.QuantityOut,
                        x.EntryCount))
                    .OrderBy(u => u.Unit)
                    .ToList()))
            .OrderBy(r => r.Location)
            .ThenByDescending(r => r.EntryCount)
            .ToList();

        var ledgerTotalsByLocation = ledgerRaw
            .GroupBy(r => r.Location)
            .Select(g => new EndOfDayInventoryLocationTotalsDto(
                g.Key,
                LocationLabel(g.Key),
                g.Sum(x => x.EntryCount),
                g.GroupBy(x => NormalizeUnit(x.InventoryUnitSnapshot))
                    .Select(u => new EndOfDayInventoryUnitFlowDto(
                        u.Key,
                        UnitLabel(u.Key),
                        u.Sum(x => x.QuantityIn),
                        u.Sum(x => x.QuantityOut),
                        u.Sum(x => x.QuantityIn) - u.Sum(x => x.QuantityOut),
                        u.Sum(x => x.EntryCount)))
                    .OrderBy(u => u.Unit)
                    .ToList()))
            .OrderBy(g => g.Location)
            .ToList();

        var unknownUnitEntries = ledgerRaw
            .Where(r => string.IsNullOrWhiteSpace(r.InventoryUnitSnapshot))
            .Sum(r => r.EntryCount);
        if (unknownUnitEntries > 0)
            gaps.Add($"{unknownUnitEntries} dòng sổ kho chưa có InventoryUnitSnapshot; "
                     + "phần này hiển thị ở nhóm \"Không xác định\", không gộp vào Gram hay Cái.");

        var queues = await GetQueueCountsAsync(filter, ct);

        var transferQuery = BuildTransferQuery(filter);
        var transfersCompleted = await transferQuery.CountAsync(ct);

        var transferUnitRaw = await transferQuery
            .SelectMany(t => t.Lines)
            .GroupBy(l => l.UnitNameSnapshot)
            .Select(g => new
            {
                Unit = g.Key,
                Quantity = g.Sum(x => x.Quantity),
                LineCount = g.Count()
            })
            .ToListAsync(ct);

        var transferQuantityByUnit = ToUnitQuantities(transferUnitRaw
            .Select(r => (r.Unit, r.Quantity, r.LineCount)));

        if (transferUnitRaw.Any(r => string.IsNullOrWhiteSpace(r.Unit)))
            gaps.Add("Một số dòng điều chuyển chưa có UnitNameSnapshot; số lượng của các dòng đó "
                     + "được tách riêng ở nhóm \"Không xác định\".");

        var productionCompleted = await db.ProductionOrders.AsNoTracking()
            .CountAsync(o => o.Status == ProductionOrderStatus.Completed
                             && o.CompletedAt != null
                             && o.CompletedAt >= filter.FromUtc
                             && o.CompletedAt < filter.ToUtcExclusive, ct);

        var receiptsCompleted = await db.SupplierReceipts.AsNoTracking()
            .CountAsync(r => r.Status == SupplierReceiptStatus.Completed
                             && r.ReviewedAt != null
                             && r.ReviewedAt >= filter.FromUtc
                             && r.ReviewedAt < filter.ToUtcExclusive, ct);

        var stocktakeQuery = db.StocktakeRequests.AsNoTracking()
            .Where(s => s.Status == StocktakeStatus.Completed
                        && s.ReviewedAt != null
                        && s.ReviewedAt >= filter.FromUtc
                        && s.ReviewedAt < filter.ToUtcExclusive);
        if (filter.Location.HasValue)
        {
            var locationName = LocationName(filter.Location.Value);
            stocktakeQuery = stocktakeQuery.Where(s => s.Location == locationName);
        }
        var stocktakesCompleted = await stocktakeQuery.CountAsync(ct);

        var endingStock = await GetEndingStockAsync(ct);
        // Chỉ ghi chú khi thực sự có tồn để đọc; kỳ không có SKU nào thì lưu ý này vô nghĩa
        // và chỉ làm hộp ghi chú luôn hiện trên báo cáo.
        if (endingStock.SkuCount > 0)
        {
            gaps.Add("Tồn cuối kỳ lấy theo trạng thái hiện tại của SkuStocks; bảng này không lưu "
                     + "đơn vị tính nên tổng tồn không tách được Gram và Cái.");
        }

        return new EndOfDayInventorySummaryResponse(
            filter.FromUtc,
            filter.ToUtcExclusive,
            "Asia/Ho_Chi_Minh",
            DateTime.UtcNow,
            ledgerByLocationAndType,
            ledgerTotalsByLocation,
            queues,
            transfersCompleted,
            transferQuantityByUnit,
            productionCompleted,
            receiptsCompleted,
            stocktakesCompleted,
            endingStock,
            gaps);
    }

    public async Task<EndOfDayInventoryQueuesResponse> GetQueuesAsync(
        EndOfDayInventoryPagedFilter filter, CancellationToken ct = default)
    {
        var (page, pageSize) = NormalizePaging(filter.Page, filter.PageSize);

        var query = db.StockDeductQueues.AsNoTracking()
            .Where(q => q.CreatedAt >= filter.FromUtc && q.CreatedAt < filter.ToUtcExclusive);

        if (filter.QueueStatus.HasValue)
            query = query.Where(q => q.QueueStatus == filter.QueueStatus.Value);

        var totalCount = await query.CountAsync(ct);

        var rows = await query
            .OrderByDescending(q => q.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(q => new
            {
                q.Id,
                q.OrderId,
                q.OrderCode,
                q.QueueStatus,
                q.CustomerSnapshotName,
                q.TotalAmount,
                q.IsDeducted,
                q.IsReserved,
                q.CreatedAt,
                q.ConfirmedAt,
                q.ConfirmedByName,
                q.CancelledAt,
                q.CancelledByName,
                q.CancelReason,
                q.LastShortageReason,
                ItemCount = q.Items.Count,
                TotalQuantity = q.Items.Sum(i => i.Quantity)
            })
            .ToListAsync(ct);

        var items = rows.Select(r => new EndOfDayInventoryQueueRowDto(
                r.Id,
                r.OrderId,
                r.OrderCode,
                r.QueueStatus.ToString(),
                QueueStatusLabel(r.QueueStatus),
                r.CustomerSnapshotName,
                r.TotalAmount,
                r.IsDeducted,
                r.IsReserved,
                r.CreatedAt,
                r.ConfirmedAt,
                r.ConfirmedByName,
                r.CancelledAt,
                r.CancelledByName,
                r.CancelReason,
                r.LastShortageReason,
                r.ItemCount,
                r.TotalQuantity))
            .ToList();

        return new EndOfDayInventoryQueuesResponse(
            items,
            page,
            pageSize,
            totalCount,
            TotalPages(totalCount, pageSize),
            await GetQueueCountsAsync(filter, ct),
            [
                "StockDeductQueueItem không có cột đơn vị tính; TotalQuantityUnknownUnit là tổng thô "
                + "của các dòng, không dùng làm số liệu Gram/Cái."
            ]);
    }

    public async Task<EndOfDayInventoryTransfersResponse> GetTransfersAsync(
        EndOfDayInventoryPagedFilter filter, CancellationToken ct = default)
    {
        var (page, pageSize) = NormalizePaging(filter.Page, filter.PageSize);

        var query = BuildTransferQuery(filter);
        var totalCount = await query.CountAsync(ct);

        var rows = await query
            .OrderByDescending(t => t.CompletedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id,
                t.TransferCode,
                t.SourceLocation,
                t.DestinationLocation,
                t.Status,
                t.CompletedAt,
                ActorName = t.CompletedByName ?? t.CreatedByName,
                SourceRequestCode = t.SourceRequest != null ? t.SourceRequest.RequestCode : null,
                SkuCount = t.Lines.Select(l => l.SkuId).Distinct().Count(),
                Lines = t.Lines.Select(l => new { l.UnitNameSnapshot, l.Quantity }).ToList()
            })
            .ToListAsync(ct);

        var items = rows.Select(r => new EndOfDayInventoryTransferRowDto(
                r.Id,
                r.TransferCode,
                r.SourceLocation,
                r.DestinationLocation,
                r.Status.ToString(),
                r.CompletedAt,
                r.ActorName,
                r.SourceRequestCode,
                r.SkuCount,
                ToUnitQuantities(r.Lines
                    .GroupBy(l => l.UnitNameSnapshot)
                    .Select(g => (g.Key, g.Sum(x => x.Quantity), g.Count())))))
            .ToList();

        // Tổng toàn kỳ tính riêng ở DB, không cộng từ trang đang xem.
        var totalsRaw = await query
            .SelectMany(t => t.Lines)
            .GroupBy(l => l.UnitNameSnapshot)
            .Select(g => new { Unit = g.Key, Quantity = g.Sum(x => x.Quantity), LineCount = g.Count() })
            .ToListAsync(ct);

        var gaps = new List<string>();
        if (totalsRaw.Any(r => string.IsNullOrWhiteSpace(r.Unit)))
            gaps.Add("Một số dòng điều chuyển chưa có UnitNameSnapshot; hiển thị ở nhóm \"Không xác định\".");

        return new EndOfDayInventoryTransfersResponse(
            items,
            page,
            pageSize,
            totalCount,
            TotalPages(totalCount, pageSize),
            ToUnitQuantities(totalsRaw.Select(r => (r.Unit, r.Quantity, r.LineCount))),
            gaps);
    }

    public async Task<EndOfDayInventoryCustomOrdersResponse> GetCustomOrdersAsync(
        EndOfDayInventoryPagedFilter filter, CancellationToken ct = default)
    {
        var (page, pageSize) = NormalizePaging(filter.Page, filter.PageSize);

        var query = db.ProductionOrders.AsNoTracking()
            .Where(o => o.Status == ProductionOrderStatus.Completed
                        && o.CompletedAt != null
                        && o.CompletedAt >= filter.FromUtc
                        && o.CompletedAt < filter.ToUtcExclusive);

        var totalCount = await query.CountAsync(ct);
        var totalOutputLineCount = await query.SelectMany(o => o.OutputLines).CountAsync(ct);

        var items = await query
            .OrderByDescending(o => o.CompletedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new EndOfDayInventoryCustomOrderRowDto(
                o.Id,
                o.ProductionCode,
                o.Status.ToString(),
                o.CompletedAt,
                o.ReviewedByName ?? o.CreatedByName,
                o.Note,
                o.Lines.Count,
                o.OutputLines.Count,
                o.OutputLines.Sum(l => l.PlannedQuantity)))
            .ToListAsync(ct);

        return new EndOfDayInventoryCustomOrdersResponse(
            items,
            page,
            pageSize,
            totalCount,
            TotalPages(totalCount, pageSize),
            totalOutputLineCount,
            [
                "ProductionOrderOutputLine không lưu đơn vị tính; PlannedOutputQuantityUnknownUnit "
                + "là tổng thô theo lệnh sản xuất, không tách Gram/Cái."
            ]);
    }

    private IQueryable<InventoryLedgerEntry> BuildLedgerQuery(EndOfDayInventoryFilter filter)
    {
        var q = db.InventoryLedgerEntries.AsNoTracking()
            .Where(e => e.OccurredAtUtc >= filter.FromUtc && e.OccurredAtUtc < filter.ToUtcExclusive);

        if (filter.Location.HasValue)
        {
            var locationName = LocationName(filter.Location.Value);
            q = q.Where(e => e.Location == locationName);
        }

        return q;
    }

    /// <summary>
    /// Phiếu điều chuyển hoàn tất trong kỳ. Bộ lọc vị trí áp cho cả nguồn và đích vì một phiếu
    /// Kho → Kệ liên quan tới cả hai bên.
    /// </summary>
    private IQueryable<StockTransfer> BuildTransferQuery(EndOfDayInventoryFilter filter)
    {
        var q = db.StockTransfers.AsNoTracking()
            .Where(t => t.Status == StockTransferStatus.Completed
                        && t.CompletedAt != null
                        && t.CompletedAt >= filter.FromUtc
                        && t.CompletedAt < filter.ToUtcExclusive);

        if (filter.Location.HasValue)
        {
            var locationName = LocationName(filter.Location.Value);
            q = q.Where(t => t.SourceLocation == locationName || t.DestinationLocation == locationName);
        }

        return q;
    }

    /// <summary>Hàng đợi trừ kho tạo trong kỳ, đếm theo trạng thái hiện tại.</summary>
    private async Task<EndOfDayInventoryQueueCountsDto> GetQueueCountsAsync(
        EndOfDayInventoryFilter filter, CancellationToken ct)
    {
        var raw = await db.StockDeductQueues.AsNoTracking()
            .Where(q => q.CreatedAt >= filter.FromUtc && q.CreatedAt < filter.ToUtcExclusive)
            .GroupBy(q => q.QueueStatus)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        int Count(QueueStatus status) => raw.FirstOrDefault(r => r.Status == status)?.Count ?? 0;

        return new EndOfDayInventoryQueueCountsDto(
            raw.Sum(r => r.Count),
            Count(QueueStatus.Waiting),
            Count(QueueStatus.Insufficient),
            Count(QueueStatus.Confirmed),
            Count(QueueStatus.Cancelled));
    }

    private async Task<EndOfDayInventoryStockSnapshotDto> GetEndingStockAsync(CancellationToken ct)
    {
        var snapshot = await db.SkuStocks.AsNoTracking()
            .GroupBy(_ => 1)
            .Select(g => new
            {
                SkuCount = g.Count(),
                Shelf = g.Sum(s => s.QuantityOnHand),
                Warehouse = g.Sum(s => s.WarehouseQuantityOnHand),
                Reserved = g.Sum(s => s.ReservedQuantity),
                ShelfLow = g.Count(s => s.ShelfLowStockThreshold > 0
                                        && s.QuantityOnHand <= s.ShelfLowStockThreshold),
                WarehouseLow = g.Count(s => s.WarehouseLowStockThreshold > 0
                                            && s.WarehouseQuantityOnHand <= s.WarehouseLowStockThreshold)
            })
            .FirstOrDefaultAsync(ct);

        if (snapshot == null)
            return new EndOfDayInventoryStockSnapshotDto(0, 0, 0, 0, 0, 0, 0);

        return new EndOfDayInventoryStockSnapshotDto(
            snapshot.SkuCount,
            snapshot.Shelf,
            snapshot.Warehouse,
            snapshot.Reserved,
            snapshot.Shelf - snapshot.Reserved,
            snapshot.ShelfLow,
            snapshot.WarehouseLow);
    }

    private static List<EndOfDayInventoryUnitQuantityDto> ToUnitQuantities(
        IEnumerable<(string? Unit, int Quantity, int LineCount)> source) =>
        source
            .GroupBy(x => NormalizeUnit(x.Unit))
            .Select(g => new EndOfDayInventoryUnitQuantityDto(
                g.Key,
                UnitLabel(g.Key),
                g.Sum(x => x.Quantity),
                g.Sum(x => x.LineCount)))
            .OrderBy(x => x.Unit)
            .ToList();

    /// <summary>Không có snapshot đơn vị thì gom vào nhóm riêng, không gán bừa Gram hay Cái.</summary>
    private static string NormalizeUnit(string? unit) =>
        string.IsNullOrWhiteSpace(unit) ? "Unknown" : unit.Trim();

    private static string UnitLabel(string unit) => unit switch
    {
        "Gram" or "gram" or "g" => "Gram",
        "Piece" or "piece" => "Cái",
        "Unknown" => "Không xác định",
        _ => unit
    };

    private static string LocationName(InventoryLocation location) =>
        location == InventoryLocation.Shelf ? LocationShelf : LocationWarehouse;

    private static string LocationLabel(string location) => location switch
    {
        LocationWarehouse => "Kho",
        LocationShelf => "Kệ Hàng",
        "Quarantine" => "Hàng cách ly",
        _ => location
    };

    private static string QueueStatusLabel(QueueStatus status) => status switch
    {
        QueueStatus.Waiting => "Chờ xử lý",
        QueueStatus.Insufficient => "Thiếu hàng",
        QueueStatus.Confirmed => "Đã xác nhận",
        QueueStatus.Cancelled => "Đã hủy",
        _ => status.ToString()
    };

    private static (int Page, int PageSize) NormalizePaging(int page, int pageSize) =>
        (page < 1 ? 1 : page, pageSize < 1 ? 20 : pageSize > MaxPageSize ? MaxPageSize : pageSize);

    private static int TotalPages(int totalCount, int pageSize) =>
        pageSize <= 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);
}
