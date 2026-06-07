using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class OrderRepository(OrderDbContext _db) : IOrderRepository
{
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

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<List<Order>> GetPendingCodAsync(CancellationToken ct = default) =>
        await _db.Orders
            .Include(o => o.Payments)
            .Where(o => o.Payments.Any(p =>
                p.PaymentMethod == PaymentMethod.COD &&
                !p.IsCodVerified &&
                p.CodWarningDate <= DateTime.UtcNow))
            .ToListAsync(ct);

    public async Task AddAsync(Order order, CancellationToken ct = default) =>
        await _db.Orders.AddAsync(order, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
