using System.Text.Json;
using Microsoft.Extensions.Logging;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.ValueObjects;

namespace OrderService.Application.Services;

/// <summary>
/// Service xử lý idempotency cho payment operations (EX-08).
/// Ngăn duplicate payment confirmation khi có double-click hoặc webhook retry.
/// </summary>
public class PaymentIdempotencyService(
    IPaymentIdempotencyRepository idempotencyRepo,
    ILogger<PaymentIdempotencyService> logger)
{
    /// <summary>
    /// Execute payment action với idempotency protection.
    /// Nếu idempotency key đã xử lý rồi, trả về kết quả cũ.
    /// Nếu chưa, execute action và lưu kết quả.
    /// </summary>
    public async Task<TResult> ExecuteWithIdempotencyAsync<TResult>(
        string idempotencyKey,
        Guid orderId,
        Guid paymentId,
        string actionType,
        Func<Task<TResult>> action,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            throw new ArgumentException("Idempotency key không được để trống.", nameof(idempotencyKey));

        // Kiểm tra đã xử lý chưa
        var existing = await idempotencyRepo.GetByKeyAsync(idempotencyKey, ct);
        if (existing is not null)
        {
            logger.LogInformation(
                "Idempotency key {Key} đã được xử lý lúc {ProcessedAt}. Trả về kết quả cũ.",
                idempotencyKey, existing.ProcessedAt);

            if (string.IsNullOrWhiteSpace(existing.ResultJson))
                return default!;

            return JsonSerializer.Deserialize<TResult>(existing.ResultJson)!;
        }

        // Thực thi action lần đầu
        var result = await action();

        // Lưu idempotency record
        var record = new PaymentIdempotency
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            PaymentId = paymentId,
            IdempotencyKey = idempotencyKey,
            ActionType = actionType,
            ResultJson = JsonSerializer.Serialize(result),
            ProcessedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await idempotencyRepo.AddAsync(record, ct);
        await idempotencyRepo.SaveChangesAsync(ct);

        logger.LogInformation(
            "Đã xử lý và lưu idempotency key {Key} cho action {ActionType}.",
            idempotencyKey, actionType);

        return result;
    }

    /// <summary>
    /// Validate state machine transition trước khi thực hiện.
    /// </summary>
    public void ValidateOrderStatusTransition(Order order, Domain.Enums.OrderStatus newStatus)
    {
        OrderStatusTransition.EnsureValidTransition(order.OrderStatus, newStatus, order.Id);
    }
}
