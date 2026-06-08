using OrderService.Domain.Entities;

namespace OrderService.Application.Interfaces;

public interface IOrderActivityRepository
{
    Task AddAsync(OrderActivity activity, CancellationToken ct = default);
    Task<List<OrderActivity>> GetByOrderIdAsync(Guid orderId, int take, CancellationToken ct = default);
}
