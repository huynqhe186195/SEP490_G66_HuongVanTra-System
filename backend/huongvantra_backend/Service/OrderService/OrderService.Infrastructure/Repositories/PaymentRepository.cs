using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class PaymentRepository(OrderDbContext _db) : IPaymentRepository
{
    public async Task<Payment?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.Payments.FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<List<Payment>> GetByOrderIdAsync(Guid orderId, CancellationToken ct = default) =>
        await _db.Payments.Where(p => p.OrderId == orderId).ToListAsync(ct);

    public async Task<List<Payment>> GetPendingCodAsync(CancellationToken ct = default) =>
        await _db.Payments
            .Include(p => p.Order)
            .Where(p =>
                p.PaymentMethod == PaymentMethod.COD &&
                !p.IsCodVerified &&
                p.CodWarningDate <= DateTime.UtcNow)
            .OrderByDescending(p => p.CodWarningDate)
            .ToListAsync(ct);

    public async Task<List<Payment>> GetUnverifiedCodAsync(CancellationToken ct = default) =>
        await _db.Payments
            .Include(p => p.Order)
            .Where(p =>
                p.PaymentMethod == PaymentMethod.COD &&
                !p.IsCodVerified)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

    public async Task AddAsync(Payment payment, CancellationToken ct = default) =>
        await _db.Payments.AddAsync(payment, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
