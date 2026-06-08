using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class OrderActivityRepository(OrderDbContext db) : IOrderActivityRepository
{
    public async Task AddAsync(OrderActivity activity, CancellationToken ct = default) =>
        await db.OrderActivities.AddAsync(activity, ct);

    public async Task<List<OrderActivity>> GetByOrderIdAsync(Guid orderId, int take, CancellationToken ct = default) =>
        await db.OrderActivities
            .Where(a => a.OrderId == orderId)
            .OrderBy(a => a.CreatedAt)
            .Take(take)
            .ToListAsync(ct);
}
