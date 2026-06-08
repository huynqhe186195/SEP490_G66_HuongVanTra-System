using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.UseCases;

public class PaymentLogic(
    IPaymentRepository _paymentRepo,
    IOrderRepository _orderRepo,
    IOrderEventPublisher _eventPublisher)
{
    public async Task<PaymentResponse> VerifyCodAsync(
        Guid paymentId, VerifyCodPaymentRequest req, CancellationToken ct = default)
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
}
