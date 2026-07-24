using OrderService.Domain.Entities;

namespace OrderService.Application.Interfaces;

public interface IOrderReceiptPrintLogRepository
{
    Task AddAsync(OrderReceiptPrintLog log, CancellationToken ct = default);
    Task<List<OrderReceiptPrintLog>> GetByOrderIdAsync(Guid orderId, CancellationToken ct = default);
    Task<OrderReceiptPrintLog?> GetByIdempotencyKeyAsync(string idempotencyKey, CancellationToken ct = default);
    Task<int> GetLastReprintNumberAsync(Guid orderId, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
