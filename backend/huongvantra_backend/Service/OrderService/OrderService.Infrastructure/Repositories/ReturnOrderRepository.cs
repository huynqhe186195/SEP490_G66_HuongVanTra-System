using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class ReturnOrderRepository(OrderDbContext _db) : IReturnOrderRepository
{
    public async Task<string> GenerateReturnCodeAsync(CancellationToken ct = default)
    {
        var today = DateTime.UtcNow.ToString("yyMMdd");
        var prefix = $"TH-{today}-";

        var lastCode = await _db.ReturnOrders
            .Where(r => r.ReturnCode.StartsWith(prefix))
            .OrderByDescending(r => r.ReturnCode)
            .Select(r => r.ReturnCode)
            .FirstOrDefaultAsync(ct);

        var seq = 1;
        if (lastCode != null)
        {
            var parts = lastCode.Split('-');
            if (parts.Length == 3 && int.TryParse(parts[2], out var last))
                seq = last + 1;
        }

        return $"{prefix}{seq:D3}";
    }

    public async Task<ReturnOrder?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.ReturnOrders
            .AsNoTracking()
            .Include(r => r.Details)
            .Include(r => r.EvidenceImages)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task<ReturnOrder?> GetTrackedByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.ReturnOrders
            .Include(r => r.Details)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task<List<ReturnOrder>> GetBySourceOrderIdAsync(Guid sourceOrderId, CancellationToken ct = default) =>
        await _db.ReturnOrders
            .AsNoTracking()
            .Include(r => r.Details)
            .Where(r => r.SourceOrderId == sourceOrderId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

    public async Task<Dictionary<Guid, int>> GetPendingReturnQuantitiesByOrderIdAsync(
        Guid sourceOrderId,
        CancellationToken ct = default)
    {
        var rows = await _db.ReturnOrderDetails
            .AsNoTracking()
            .Where(d => d.ReturnOrder!.SourceOrderId == sourceOrderId
                        && d.ReturnOrder.AcceptanceStatus == ReturnAcceptanceStatus.Pending
                        && !d.IsDeleted
                        && !d.ReturnOrder.IsDeleted)
            .GroupBy(d => d.SourceOrderDetailId)
            .Select(g => new { SourceOrderDetailId = g.Key, Qty = g.Sum(x => x.ReturnQuantity) })
            .ToListAsync(ct);

        return rows.ToDictionary(x => x.SourceOrderDetailId, x => x.Qty);
    }

    public async Task<(List<(ReturnOrder Item, OrderChannel SourceChannel)> Items, int Total)> GetPagedAsync(
        string? search, string? sourceChannel, Guid? employeeId, bool includeAllCodOrders,
        int page, int pageSize, CancellationToken ct = default)
    {
        var query =
            from r in _db.ReturnOrders.AsNoTracking()
            join o in _db.Orders.AsNoTracking() on r.SourceOrderId equals o.Id
            select new { Return = r, SourceChannel = o.OrderChannel, SourceEmployeeId = o.EmployeeId };

        if (employeeId.HasValue)
        {
            query = query.Where(x =>
                (includeAllCodOrders && x.SourceChannel == OrderChannel.COD)
                || (x.SourceChannel != OrderChannel.COD && x.SourceEmployeeId == employeeId.Value));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            query = query.Where(x =>
                x.Return.ReturnCode.ToUpper().Contains(term)
                || x.Return.SourceOrderCode.ToUpper().Contains(term)
                || (x.Return.CustomerSnapshotName != null
                    && x.Return.CustomerSnapshotName.ToUpper().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(sourceChannel)
            && Enum.TryParse<OrderChannel>(sourceChannel, true, out var parsedChannel))
        {
            query = query.Where(x => x.SourceChannel == parsedChannel);
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.Return.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new ValueTuple<ReturnOrder, OrderChannel>(x.Return, x.SourceChannel))
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<List<(ReturnOrder Item, OrderChannel SourceChannel)>> GetAllForExportAsync(
        string? search, string? sourceChannel, Guid? employeeId, bool includeAllCodOrders,
        int maxRows, CancellationToken ct = default)
    {
        var query =
            from r in _db.ReturnOrders.AsNoTracking()
            join o in _db.Orders.AsNoTracking() on r.SourceOrderId equals o.Id
            select new { Return = r, SourceChannel = o.OrderChannel, SourceEmployeeId = o.EmployeeId };

        if (employeeId.HasValue)
        {
            query = query.Where(x =>
                (includeAllCodOrders && x.SourceChannel == OrderChannel.COD)
                || (x.SourceChannel != OrderChannel.COD && x.SourceEmployeeId == employeeId.Value));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            query = query.Where(x =>
                x.Return.ReturnCode.ToUpper().Contains(term)
                || x.Return.SourceOrderCode.ToUpper().Contains(term)
                || (x.Return.CustomerSnapshotName != null
                    && x.Return.CustomerSnapshotName.ToUpper().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(sourceChannel)
            && Enum.TryParse<OrderChannel>(sourceChannel, true, out var parsedChannel))
        {
            query = query.Where(x => x.SourceChannel == parsedChannel);
        }

        var take = Math.Clamp(maxRows, 1, 10_000);
        return await query
            .OrderByDescending(x => x.Return.CreatedAt)
            .Take(take)
            .Select(x => new ValueTuple<ReturnOrder, OrderChannel>(x.Return, x.SourceChannel))
            .ToListAsync(ct);
    }

    public async Task<string?> GetExchangeOrderCodeAsync(Guid exchangeOrderId, CancellationToken ct = default) =>
        await _db.Orders
            .AsNoTracking()
            .Where(o => o.Id == exchangeOrderId)
            .Select(o => o.OrderCode)
            .FirstOrDefaultAsync(ct);

    public async Task AddAsync(ReturnOrder returnOrder, CancellationToken ct = default) =>
        await _db.ReturnOrders.AddAsync(returnOrder, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
