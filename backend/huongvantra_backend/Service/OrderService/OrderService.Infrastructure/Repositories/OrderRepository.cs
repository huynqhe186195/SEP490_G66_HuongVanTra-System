using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
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
        int page, int pageSize, CancellationToken ct = default)
    {
        var query = _db.Orders.AsQueryable();

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
                var now = DateTime.UtcNow;
                query = query.Where(o =>
                    o.Payments.Any(p =>
                        p.PaymentMethod == PaymentMethod.COD
                        && !p.IsCodVerified
                        && p.CodWarningDate != null
                        && p.CodWarningDate <= now));
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

        var total = await query.CountAsync(ct);
        var items = await query
            .Include(o => o.Payments)
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
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

    public async Task AddAsync(Order order, CancellationToken ct = default) =>
        await _db.Orders.AddAsync(order, ct);

    public async Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        await _db.SaveChangesAsync(ct);
}
