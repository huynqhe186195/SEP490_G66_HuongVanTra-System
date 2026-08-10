using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;
using OrderService.Domain.Rules;

namespace OrderService.Application.UseCases;

/// <summary>
/// In lại hóa đơn có kiểm soát: mỗi lần in lại hợp lệ ghi đúng một bản ghi audit
/// <see cref="OrderReceiptPrintLog"/>. Không thay đổi tổng tiền, thanh toán, công nợ,
/// khuyến mãi hay tồn kho của Order. Không giới hạn theo Sale sở hữu đơn.
/// </summary>
public class ReceiptReprintLogic(
    IOrderRepository _orderRepo,
    IOrderReceiptPrintLogRepository _printLogRepo)
{
    private const int MaxReasonLength = 500;

    public async Task<ReceiptReprintResponse> ReprintAsync(
        Guid orderId,
        string? reason,
        Guid? actorId,
        string? actorName,
        string? clientIdempotencyKey,
        OrderAccessContext access,
        CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);

        EnsureCanView(order, access);
        EnsureReprintable(order);

        var trimmedReason = (reason ?? string.Empty).Trim();
        if (trimmedReason.Length == 0)
            throw new OrderValidationException("Lý do in lại hóa đơn là bắt buộc.");
        if (trimmedReason.Length > MaxReasonLength)
            throw new OrderValidationException($"Lý do in lại hóa đơn tối đa {MaxReasonLength} ký tự.");

        var idempotencyKey = string.IsNullOrWhiteSpace(clientIdempotencyKey)
            ? null
            : OrderIdempotency.BuildActorScopedKey(clientIdempotencyKey, actorId);

        if (idempotencyKey is not null)
        {
            var existing = await _printLogRepo.GetByIdempotencyKeyAsync(idempotencyKey, ct);
            if (existing is not null)
                return BuildResponse(order, existing);
        }

        var log = new OrderReceiptPrintLog
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            PrintedByUserId = actorId,
            PrintedByName = actorName,
            Reason = trimmedReason,
            ReprintNumber = await _printLogRepo.GetLastReprintNumberAsync(order.Id, ct) + 1,
            IdempotencyKey = idempotencyKey,
            PrintedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        };

        try
        {
            await _printLogRepo.AddAsync(log, ct);
            await _printLogRepo.SaveChangesAsync(ct);
        }
        catch (DuplicateOrderIdempotencyKeyException) when (idempotencyKey is not null)
        {
            var existing = await _printLogRepo.GetByIdempotencyKeyAsync(idempotencyKey, ct);
            if (existing is null) throw;
            return BuildResponse(order, existing);
        }

        return BuildResponse(order, log);
    }

    public async Task<List<ReceiptReprintLogResponse>> GetHistoryAsync(
        Guid orderId, OrderAccessContext access, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);

        EnsureCanView(order, access);

        var logs = await _printLogRepo.GetByOrderIdAsync(orderId, ct);
        return logs.Select(MapLog).ToList();
    }

    private static void EnsureCanView(Order order, OrderAccessContext access)
    {
        if (!access.CanViewOrder(order))
            throw new OrderForbiddenException();
    }

    private static void EnsureReprintable(Order order)
    {
        if (order.OrderStatus != OrderStatus.Completed)
            throw new OrderValidationException(
                "Chỉ đơn hàng đã hoàn tất mới được in lại hóa đơn.");
    }

    private static ReceiptReprintLogResponse MapLog(OrderReceiptPrintLog log) => new(
        log.Id, log.OrderId, log.PrintedByUserId, log.PrintedByName,
        log.Reason, log.ReprintNumber, log.PrintedAt);

    private static ReceiptReprintResponse BuildResponse(Order order, OrderReceiptPrintLog log) =>
        new(MapLog(log), BuildReceipt(order, log));

    private static ReceiptReprintDataResponse BuildReceipt(Order order, OrderReceiptPrintLog log)
    {
        var items = (order.OrderDetails ?? [])
            .Select(d => new ReceiptReprintItemResponse(
                d.SkuSnapshotCode, d.SkuSnapshotName, d.Quantity, d.UnitPrice, d.SubTotal))
            .ToList();

        var payments = order.Payments ?? [];
        var primaryPayment = payments
            .OrderByDescending(p => p.PaymentStatus == PaymentStatus.Success)
            .ThenByDescending(p => p.Amount)
            .FirstOrDefault();

        var amountPaid = payments
            .Where(p => p.PaymentStatus == PaymentStatus.Success)
            .Sum(p => p.Amount);

        var grossSubtotal = items.Sum(i => i.Total);

        return new ReceiptReprintDataResponse(
            order.Id,
            order.OrderCode,
            primaryPayment?.TransactionRef,
            order.CustomerSnapshotName ?? "Khách lẻ",
            primaryPayment is null ? "—" : GetPaymentMethodLabel(primaryPayment.PaymentMethod),
            order.CreatedAt,
            null,
            items,
            grossSubtotal,
            order.DiscountAmount + order.PromotionDiscountAmount,
            order.FinalAmount,
            amountPaid,
            Math.Max(0, order.FinalAmount - amountPaid),
            true,
            log.ReprintNumber,
            log.PrintedAt,
            order.BackorderAcceptedAt.HasValue,
            order.FulfillmentPreference?.ToString(),
            order.EstimatedReadyFrom,
            order.EstimatedReadyTo,
            order.PickupDate,
            order.PickupContactName,
            order.PickupContactPhone,
            order.PickupCode);
    }

    private static string GetPaymentMethodLabel(PaymentMethod method) => method switch
    {
        PaymentMethod.Cash => "Tiền mặt",
        PaymentMethod.VietQR => "VietQR",
        PaymentMethod.BankTransfer => "Chuyển khoản",
        PaymentMethod.COD => "COD — thu khi giao",
        _ => method.ToString()
    };
}
