using System.Globalization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.UseCases;

public class PaymentLogic(
    IPaymentRepository _paymentRepo,
    IOrderRepository _orderRepo,
    IOrderEventPublisher _eventPublisher,
    IOrderActivityRepository _activityRepo)
{
    public async Task<PaymentResponse> VerifyCodAsync(
        Guid paymentId,
        VerifyCodPaymentRequest req,
        Guid? actorId = null,
        string? actorName = null,
        CancellationToken ct = default)
    {
        var payment = await _paymentRepo.GetByIdAsync(paymentId, ct)
            ?? throw new PaymentNotFoundException(paymentId);

        if (payment.PaymentMethod != PaymentMethod.COD)
            throw new OrderValidationException("Chỉ có thể xác nhận thanh toán COD.");

        payment.IsCodVerified = true;
        payment.PaymentStatus = PaymentStatus.Success;
        payment.TransactionRef = req.TransactionRef?.Trim();
        payment.PaidAt = DateTime.UtcNow;

        var order = await _orderRepo.GetByIdAsync(payment.OrderId, ct)
            ?? throw new OrderNotFoundException(payment.OrderId);

        order.OrderStatus = OrderStatus.Completed;
        order.UpdatedAt = DateTime.UtcNow;

        var codDescription = string.IsNullOrWhiteSpace(payment.TransactionRef)
            ? $"Xác nhận thu COD {FormatVnd(order.FinalAmount)}."
            : $"Xác nhận thu COD {FormatVnd(order.FinalAmount)}. Mã tham chiếu: {payment.TransactionRef}.";

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.CodVerified,
            codDescription,
            actorId,
            actorName,
            ct);

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Completed,
            "Hoàn tất đơn hàng sau khi xác nhận thu COD.",
            actorId,
            actorName,
            ct);

        await _paymentRepo.SaveChangesAsync(ct);

        if (order.CustomerId.HasValue)
        {
            var payments = await _paymentRepo.GetByOrderIdAsync(order.Id, ct);
            var paidAmount = payments.Where(p => p.PaymentStatus == PaymentStatus.Success).Sum(p => p.Amount);
            var debtAmount = Math.Max(0, order.FinalAmount - paidAmount);

            await _eventPublisher.PublishOrderCompletedAsync(
                order.Id, order.OrderCode, order.CustomerId.Value,
                order.FinalAmount, debtAmount,
                (order.OrderDetails ?? []).Select(d => (d.SkuId, d.Quantity)),
                ct);
        }

        return MapToResponse(payment);
    }

    public async Task<List<PaymentResponse>> GetByOrderIdAsync(Guid orderId, CancellationToken ct = default)
    {
        var payments = await _paymentRepo.GetByOrderIdAsync(orderId, ct);
        return payments.Select(MapToResponse).ToList();
    }

    public async Task<List<PaymentResponse>> GetPendingCodAsync(CancellationToken ct = default)
    {
        var payments = await _paymentRepo.GetPendingCodAsync(ct);
        return payments.Select(MapToResponse).ToList();
    }

    public async Task<List<PaymentResponse>> GetUnverifiedCodAsync(CancellationToken ct = default)
    {
        var payments = await _paymentRepo.GetUnverifiedCodAsync(ct);
        return payments.Select(MapToResponse).ToList();
    }

    private async Task RecordActivityAsync(
        Guid orderId,
        OrderActivityType type,
        string description,
        Guid? actorId,
        string? actorName,
        CancellationToken ct)
    {
        await _activityRepo.AddAsync(new OrderActivity
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            ActivityType = type,
            Description = description,
            ActorId = actorId == Guid.Empty ? null : actorId,
            ActorName = string.IsNullOrWhiteSpace(actorName) ? null : actorName.Trim(),
            CreatedAt = DateTime.UtcNow
        }, ct);
    }

    private static PaymentResponse MapToResponse(Domain.Entities.Payment p) => new(
        p.Id,
        p.OrderId,
        p.Order?.OrderCode,
        p.Order?.CustomerSnapshotName,
        p.PaymentMethod.ToString(),
        p.Amount,
        p.PaymentStatus.ToString(),
        p.TransactionRef,
        p.IsCodVerified,
        p.CodWarningDate,
        p.PaidAt);

    private static string FormatVnd(decimal amount)
    {
        var value = Math.Round(amount, 0, MidpointRounding.AwayFromZero);
        var digits = Math.Abs(value).ToString(CultureInfo.InvariantCulture);
        var chars = new List<char>(digits.Length + digits.Length / 3);
        for (var i = 0; i < digits.Length; i++)
        {
            if (i > 0 && (digits.Length - i) % 3 == 0) chars.Add('.');
            chars.Add(digits[i]);
        }

        var formatted = value < 0 ? "-" + new string(chars.ToArray()) : new string(chars.ToArray());
        return formatted + " ₫";
    }
}
