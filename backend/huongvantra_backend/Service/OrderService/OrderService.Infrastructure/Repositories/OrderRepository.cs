using Microsoft.EntityFrameworkCore;
using MySqlConnector;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class OrderRepository(OrderDbContext _db) : IOrderRepository
{
    private const string ExchangeOrderCodePrefix = "HVT-DOI-";

    public async Task<Order?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.Orders
            .Include(o => o.OrderDetails)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

    public async Task<Order?> GetByCodeAsync(string orderCode, CancellationToken ct = default) =>
        await _db.Orders
            .Include(o => o.OrderDetails)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.OrderCode == orderCode, ct);

    public async Task<(List<Order> Items, int TotalCount)> GetPagedAsync(
        string? search, Guid? customerId, string? status, string? channel,
        string? excludeChannel, string? codTab, bool returnableOnly,
        string? orderKind, string? excludeOrderKind,
        DateTime? fromDate, DateTime? toDate, Guid? employeeId, bool includeAllCodOrders,
        int page, int pageSize, CancellationToken ct = default,
        IReadOnlyCollection<Guid>? restrictToOrderIds = null)
    {
        var query = BuildListQuery(
            search, customerId, status, channel,
            excludeChannel, codTab, returnableOnly,
            orderKind, excludeOrderKind,
            fromDate, toDate, employeeId, includeAllCodOrders,
            restrictToOrderIds);

        var total = await query.CountAsync(ct);
         var items = await query
            .Include(o => o.Payments)
            .Include(o => o.OrderDetails)
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<Dictionary<string, int>> CountByStatusAsync(
        string? search, Guid? customerId, string? channel,
        string? excludeChannel, string? codTab, bool returnableOnly,
        string? orderKind, string? excludeOrderKind,
        DateTime? fromDate, DateTime? toDate, Guid? employeeId, bool includeAllCodOrders,
        CancellationToken ct = default,
        IReadOnlyCollection<Guid>? restrictToOrderIds = null)
    {
        var query = BuildListQuery(
            search, customerId, status: null, channel,
            excludeChannel, codTab, returnableOnly,
            orderKind, excludeOrderKind,
            fromDate, toDate, employeeId, includeAllCodOrders,
            restrictToOrderIds);

        var rows = await query
            .GroupBy(o => o.OrderStatus)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToListAsync(ct);
        return rows.ToDictionary(
            row => row.Status.ToString(),
            row => row.Count,
            StringComparer.OrdinalIgnoreCase);
    }

    private IQueryable<Order> BuildListQuery(
        string? search, Guid? customerId, string? status, string? channel,
        string? excludeChannel, string? codTab, bool returnableOnly,
        string? orderKind, string? excludeOrderKind,
        DateTime? fromDate, DateTime? toDate, Guid? employeeId, bool includeAllCodOrders,
        IReadOnlyCollection<Guid>? restrictToOrderIds)
    {
        var query = _db.Orders.AsQueryable();

        // POS-04 (truy vết giữ chỗ): tập OrderId đang giữ chỗ do InventoryService trả về qua service client.
        if (restrictToOrderIds != null)
        {
            var reservedIds = restrictToOrderIds.ToList();
            query = query.Where(o => reservedIds.Contains(o.Id));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(o =>
                o.OrderCode.ToLower().Contains(s) ||
                (o.CustomerSnapshotName != null && o.CustomerSnapshotName.ToLower().Contains(s)));
        }

        if (customerId.HasValue)
            query = query.Where(o => o.CustomerId == customerId);

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<OrderStatus>(status, true, out var parsedStatus))
            query = query.Where(o => o.OrderStatus == parsedStatus);

        if (!string.IsNullOrWhiteSpace(channel) &&
            Enum.TryParse<OrderChannel>(channel, true, out var parsedChannel))
            query = query.Where(o => o.OrderChannel == parsedChannel);

        if (!string.IsNullOrWhiteSpace(excludeChannel) &&
            Enum.TryParse<OrderChannel>(excludeChannel, true, out var excludedChannel))
            query = query.Where(o => o.OrderChannel != excludedChannel);

        var codTabKey = codTab?.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(codTabKey))
        {
            query = query.Where(o => o.OrderChannel == OrderChannel.COD);

            if (codTabKey == "pending")
            {
                query = query.Where(o =>
                    o.OrderStatus != OrderStatus.Completed
                    && o.OrderStatus != OrderStatus.Cancelled
                    && o.Payments.Any(p =>
                        p.PaymentMethod == PaymentMethod.COD && !p.IsCodVerified));
            }
            else if (codTabKey == "overdue")
            {
                var overdueCutoff = DateTime.UtcNow.AddDays(-7);
                query = query.Where(o =>
                    o.OrderStatus != OrderStatus.Completed
                    && o.OrderStatus != OrderStatus.Cancelled
                    && o.CreatedAt <= overdueCutoff
                    && o.Payments.Any(p =>
                        p.PaymentMethod == PaymentMethod.COD
                        && !p.IsCodVerified));
            }
            else if (codTabKey == "done")
            {
                query = query.Where(o => o.OrderStatus == OrderStatus.Completed);
            }
        }

        if (!string.IsNullOrWhiteSpace(orderKind) &&
            Enum.TryParse<OrderKind>(orderKind, true, out var parsedKind))
        {
            if (parsedKind == OrderKind.Exchange)
            {
                query = query.Where(o =>
                    o.OrderKind == OrderKind.Exchange
                    || o.OrderCode.StartsWith(ExchangeOrderCodePrefix)
                    || _db.ReturnOrders.Any(r => r.ExchangeOrderId == o.Id));
            }
            else
            {
                query = query.Where(o => o.OrderKind == parsedKind);
            }
        }

        if (!string.IsNullOrWhiteSpace(excludeOrderKind) &&
            Enum.TryParse<OrderKind>(excludeOrderKind, true, out var excludedKind))
        {
            if (excludedKind == OrderKind.Exchange)
            {
                query = query.Where(o =>
                    o.OrderKind != OrderKind.Exchange
                    && !o.OrderCode.StartsWith(ExchangeOrderCodePrefix)
                    && !_db.ReturnOrders.Any(r => r.ExchangeOrderId == o.Id));
            }
            else
            {
                query = query.Where(o => o.OrderKind != excludedKind);
            }
        }

        if (returnableOnly)
        {
            query = query.Where(o =>
                o.OrderKind == OrderKind.Sale
                && o.OrderDetails.Any(d => d.ReturnedQuantity < d.Quantity));
        }

        if (employeeId.HasValue)
        {
            query = query.Where(o =>
                (includeAllCodOrders && o.OrderChannel == OrderChannel.COD)
                || (
                    o.OrderChannel != OrderChannel.COD
                    && (
                        o.EmployeeId == employeeId
                        || _db.OrderActivities.Any(a =>
                            a.OrderId == o.Id
                            && a.ActivityType == OrderActivityType.Created
                            && a.ActorId == employeeId)
                    )
                ));
        }

        if (fromDate.HasValue)
            query = query.Where(o => o.CreatedAt >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(o => o.CreatedAt <= toDate.Value);

        return query;
    }

    public async Task<Order?> GetSinglePendingTransferByAmountAsync(
        decimal amount, int toleranceVnd, CancellationToken ct = default)
    {
        var tolerance = Math.Max(0, toleranceVnd);
        var minAmount = amount - tolerance;
        var maxAmount = amount + tolerance;

        var candidates = await _db.Orders
            .Include(o => o.Payments)
            .Where(o =>
                o.OrderStatus == OrderStatus.PendingPayment
                && o.FinalAmount >= minAmount
                && o.FinalAmount <= maxAmount
                && o.Payments.Any(p =>
                    (p.PaymentMethod == PaymentMethod.VietQR || p.PaymentMethod == PaymentMethod.BankTransfer)
                    && p.PaymentStatus == PaymentStatus.Pending))
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);

        return candidates.Count == 1 ? candidates[0] : null;
    }

    // Chế độ QR test: số tiền nhận được không còn phản ánh FinalAmount nên không dò theo tiền được.
    // Chỉ nhận khi có đúng một đơn đang chờ chuyển khoản và QR chưa hết hạn.
    public async Task<Order?> GetLatestPendingTransferAsync(
        DateTime utcNow, CancellationToken ct = default)
    {
        var candidates = await _db.Orders
            .Include(o => o.Payments)
            .Where(o =>
                o.OrderStatus == OrderStatus.PendingPayment
                && o.Payments.Any(p =>
                    (p.PaymentMethod == PaymentMethod.VietQR || p.PaymentMethod == PaymentMethod.BankTransfer)
                    && p.PaymentStatus == PaymentStatus.Pending
                    && (p.TransferQrExpiresAtUtc == null || p.TransferQrExpiresAtUtc > utcNow)))
            .OrderByDescending(o => o.CreatedAt)
            .Take(2)
            .ToListAsync(ct);

        return candidates.Count == 1 ? candidates[0] : null;
    }

    public async Task<List<Order>> GetPendingCodAsync(CancellationToken ct = default) =>
        await _db.Orders
            .Include(o => o.Payments)
            .Where(o =>
                o.OrderChannel == OrderChannel.COD
                && o.Payments.Any(p =>
                    p.PaymentMethod == PaymentMethod.COD
                    && !p.IsCodVerified
                    && p.CodWarningDate != null
                    && p.CodWarningDate <= DateTime.UtcNow))
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);

    public async Task<Order?> GetByIdempotencyKeyAsync(string key, CancellationToken ct = default) =>
        await _db.Orders
            .Include(o => o.OrderDetails)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.IdempotencyKey == key, ct);

    /// <summary>
    /// B2/B5: CurrentDebt bên CustomerService chỉ tăng khi đơn Completed. Giữa lúc lập nhiều đơn
    /// hợp đồng liên tiếp, phần nợ đang chờ này phải được cộng vào khi kiểm hạn mức tín dụng.
    /// </summary>
    public async Task<decimal> GetPendingContractDebtAsync(
        Guid customerId, Guid? excludeOrderId, CancellationToken ct = default) =>
        await _db.Orders
            .Where(o =>
                o.CustomerId == customerId
                && o.ContractId != null
                && o.OrderStatus != OrderStatus.Completed
                && o.OrderStatus != OrderStatus.Cancelled
                && (excludeOrderId == null || o.Id != excludeOrderId))
            .SumAsync(o =>
                o.FinalAmount
                - (o.Payments
                    .Where(p => p.PaymentStatus == PaymentStatus.Success)
                    .Sum(p => (decimal?)p.Amount) ?? 0m),
                ct);

    public async Task<bool> TryTransitionStatusAsync(
        Guid orderId,
        OrderStatus expectedStatus,
        OrderStatus nextStatus,
        CancellationToken ct = default) =>
        await _db.Orders
            .Where(order => order.Id == orderId && order.OrderStatus == expectedStatus)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(order => order.OrderStatus, nextStatus)
                    .SetProperty(order => order.UpdatedAt, DateTime.UtcNow),
                ct) == 1;

    public async Task AddAsync(Order order, CancellationToken ct = default) =>
        await _db.Orders.AddAsync(order, ct);

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        try
        {
            return await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException exception) when (IsIdempotencyKeyConflict(exception))
        {
            throw new DuplicateOrderIdempotencyKeyException(exception);
        }
    }

    private static bool IsIdempotencyKeyConflict(DbUpdateException exception) =>
        exception.InnerException is MySqlException { Number: 1062 } mysqlException
        && mysqlException.Message.Contains("IdempotencyKey", StringComparison.OrdinalIgnoreCase);
}
