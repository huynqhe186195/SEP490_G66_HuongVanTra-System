using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class PaymentIdempotencyRepository(OrderDbContext db) : IPaymentIdempotencyRepository
{
    public Task<PaymentIdempotency?> GetByKeyAsync(string idempotencyKey, CancellationToken ct = default) =>
        db.PaymentIdempotencies
            .FirstOrDefaultAsync(p => p.IdempotencyKey == idempotencyKey, ct);

    public async Task AddAsync(PaymentIdempotency record, CancellationToken ct = default) =>
        await db.PaymentIdempotencies.AddAsync(record, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        db.SaveChangesAsync(ct);
}
