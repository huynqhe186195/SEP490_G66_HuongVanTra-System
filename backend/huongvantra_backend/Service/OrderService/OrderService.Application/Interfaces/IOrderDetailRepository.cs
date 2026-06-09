using OrderService.Domain.Entities;

namespace OrderService.Application.Interfaces;

public interface IOrderDetailRepository
{
    Task<List<OrderDetail>> GetByOrderIdAsync(Guid orderId, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<OrderDetail> details, CancellationToken ct = default);
}
