using OrderService.Domain.Entities;

namespace OrderService.Application.Interfaces;

/// <summary>
/// Repository cho PaymentIdempotency — ngăn duplicate payment processing (EX-08).
/// </summary>
public interface IPaymentIdempotencyRepository
{
    /// <summary>Kiểm tra idempotency key đã được xử lý chưa.</summary>
    Task<PaymentIdempotency?> GetByKeyAsync(string idempotencyKey, CancellationToken ct = default);

    /// <summary>Lưu idempotency record sau khi xử lý thành công.</summary>
    Task AddAsync(PaymentIdempotency record, CancellationToken ct = default);

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
