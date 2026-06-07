using OrderService.Domain.Entities;

namespace OrderService.Application.Interfaces;

public interface IPaymentRepository
{
    Task<Payment?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<Payment>> GetByOrderIdAsync(Guid orderId, CancellationToken ct = default);
    Task<List<Payment>> GetPendingCodAsync(CancellationToken ct = default);
    Task<List<Payment>> GetUnverifiedCodAsync(CancellationToken ct = default);
    Task AddAsync(Payment payment, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
