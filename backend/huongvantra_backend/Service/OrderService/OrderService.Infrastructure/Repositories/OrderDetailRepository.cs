using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class OrderDetailRepository(OrderDbContext _db) : IOrderDetailRepository
{
    public async Task<List<OrderDetail>> GetByOrderIdAsync(Guid orderId, CancellationToken ct = default) =>
        await _db.OrderDetails.Where(d => d.OrderId == orderId).ToListAsync(ct);

    public async Task AddRangeAsync(IEnumerable<OrderDetail> details, CancellationToken ct = default) =>
        await _db.OrderDetails.AddRangeAsync(details, ct);
}
