using System.Globalization;
using OrderService.Application.Authorization;
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
    IOrderActivityRepository _activityRepo,
    StaffShiftGuard _shiftGuard)
{
    public async Task<PaymentResponse> VerifyCodAsync(
        Guid paymentId,
        VerifyCodPaymentRequest req,
        OrderAccessContext access,
        Guid? actorId = null,
        string? actorName = null,
        CancellationToken ct = default)
    {
        await _shiftGuard.EnsureShelfOnDutyAsync(access, ct);

        var payment = await _paymentRepo.GetByIdAsync(paymentId, ct)
            ?? throw new PaymentNotFoundException(paymentId);

        if (payment.PaymentMethod != PaymentMethod.COD)
            throw new OrderValidationException("Chỉ có thể xác nhận thanh toán COD.");

        if (payment.IsCodVerified)
            throw new OrderValidationException("Đơn COD này đã được xác nhận thu tiền rồi.");

        var order = await _orderRepo.GetByIdAsync(payment.OrderId, ct)
            ?? throw new OrderNotFoundException(payment.OrderId);
        EnsureCanModify(order, access);

        if (order.OrderStatus == OrderStatus.Cancelled)
            throw new OrderValidationException("Không thể xác nhận thu COD cho đơn đã hủy.");
        if (order.OrderStatus == OrderStatus.Completed && payment.IsCodVerified)
            throw new OrderValidationException("Đơn COD này đã được xác nhận thu tiền rồi.");
        if (order.OrderStatus is OrderStatus.Draft or OrderStatus.CancellationRequested)
            throw new OrderValidationException("Trạng thái đơn hiện tại không cho phép thu COD.");
        if (order.OrderStatus != OrderStatus.Shipping)
            throw new OrderValidationException(
                "Chỉ thu COD khi đơn đang giao. Hãy bấm «Chuyển sang đang giao» trước khi xác nhận đã giao và thu tiền.");

        var collected = req.CollectedAmount > 0 ? req.CollectedAmount : order.FinalAmount;
        if (collected < order.FinalAmount)
            throw new OrderValidationException(
                $"Số tiền thu ({FormatVnd(collected)}) không đủ thành tiền đơn ({FormatVnd(order.FinalAmount)}).");

        // Chỉ lưu phần tiền thực tế áp dụng vào đơn; tiền thừa được xử lý riêng
        // qua debt settlement/tiền trả lại và không làm phình aggregate đã thanh toán.
        payment.Amount = Math.Min(collected, order.FinalAmount);
        payment.IsCodVerified = true;
        payment.PaymentStatus = PaymentStatus.Success;
        payment.TransactionRef = req.TransactionRef?.Trim();
        payment.PaidAt = DateTime.UtcNow;

        order.OrderStatus = OrderStatus.Completed;
        order.UpdatedAt = DateTime.UtcNow;
        order.CompletedAt ??= order.UpdatedAt;

        var overpay = Math.Max(collected - order.FinalAmount, 0);
        var codDescription = string.IsNullOrWhiteSpace(payment.TransactionRef)
            ? overpay > 0
                ? $"Xác nhận thu COD {FormatVnd(collected)} (đơn {FormatVnd(order.FinalAmount)}, thừa {FormatVnd(overpay)})."
                : $"Xác nhận thu COD {FormatVnd(collected)}."
            : overpay > 0
                ? $"Xác nhận thu COD {FormatVnd(collected)} (đơn {FormatVnd(order.FinalAmount)}, thừa {FormatVnd(overpay)}). Mã tham chiếu: {payment.TransactionRef}."
                : $"Xác nhận thu COD {FormatVnd(collected)}. Mã tham chiếu: {payment.TransactionRef}.";

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

        // G4: enqueue integration events vào Outbox TRƯỚC khi SaveChanges để
        // OutboxMessage được commit cùng transaction với payment/order/activity.
        // Cập nhật StockDeductQueue.OrderPaymentStatus + kích hoạt trừ tồn (Inventory OrderPlaced handler).
        // POS-04 (quyết định #8): nếu đơn đã Shipping và tồn đã trừ qua OrderShippedEvent,
        // Inventory bỏ qua nhờ guard IsDeducted/QueueStatus — không trừ lần hai.
        await _eventPublisher.PublishOrderPlacedAsync(
            order.Id,
            order.OrderCode,
            OrderStatus.Completed.ToString(),
            order.OrderChannel.ToString(),
            order.FinalAmount,
            (order.OrderDetails ?? []).Select(d => (
                d.SkuId,
                d.SkuSnapshotName,
                d.SkuSnapshotCode,
                d.Quantity)),
            order.CustomerSnapshotName,
            ct);

        if (order.CustomerId.HasValue)
        {
            var paidForOrder = Math.Min(collected, order.FinalAmount);
            var debtAmount = Math.Max(0, order.FinalAmount - paidForOrder);

            // Ưu tiên settlement JSON được truyền lên lúc verify (cashier có thể cấu hình lại).
            // Fallback về giá trị đã lưu khi tạo đơn COD nếu cashier không truyền mới.
            var settlementJson = !string.IsNullOrWhiteSpace(req.DebtSettlementJson)
                ? req.DebtSettlementJson
                : string.IsNullOrWhiteSpace(payment.CodDebtSettlementJson)
                    ? null
                    : payment.CodDebtSettlementJson;

            await _eventPublisher.PublishOrderCompletedAsync(
                order.Id, order.OrderCode, order.CustomerId.Value,
                order.FinalAmount, debtAmount,
                (order.OrderDetails ?? []).Select(d => (d.SkuId, d.Quantity)),
                settlementJson,
                ct);
        }

        // Business state + outbox rows commit atomically here.
        await _paymentRepo.SaveChangesAsync(ct);

        return MapToResponse(payment);
    }

    public async Task<List<PaymentResponse>> GetByOrderIdAsync(
        Guid orderId, OrderAccessContext access, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);
        EnsureCanView(order, access);

        var payments = await _paymentRepo.GetByOrderIdAsync(orderId, ct);
        return payments.Select(MapToResponse).ToList();
    }

    public async Task<List<PaymentResponse>> GetPendingCodAsync(
        OrderAccessContext access, CancellationToken ct = default)
    {
        var payments = await _paymentRepo.GetPendingCodAsync(ct);
        return payments
            .Where(p => p.Order is not null && access.CanViewOrder(p.Order))
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<List<PaymentResponse>> GetUnverifiedCodAsync(
        OrderAccessContext access, CancellationToken ct = default)
    {
        var payments = await _paymentRepo.GetUnverifiedCodAsync(ct);
        return payments
            .Where(p => p.Order is not null && access.CanViewOrder(p.Order))
            .Select(MapToResponse)
            .ToList();
    }

    private static void EnsureCanView(Order order, OrderAccessContext access)
    {
        if (!access.CanViewOrder(order))
            throw new OrderForbiddenException();
    }

    private static void EnsureCanModify(Order order, OrderAccessContext access)
    {
        if (!access.CanModifyOrder(order))
            throw new OrderForbiddenException();
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
        p.PaidAt,
        p.CodDebtSettlementJson);

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
