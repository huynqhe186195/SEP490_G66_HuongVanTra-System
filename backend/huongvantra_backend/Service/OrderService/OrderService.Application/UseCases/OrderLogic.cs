using System.Globalization;
using Microsoft.Extensions.Options;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Application.Validation;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.UseCases;

public class OrderLogic(
    IOrderRepository _orderRepo,
    IPaymentRepository _paymentRepo,
    IOrderCodeGenerator _codeGen,
    IOrderEventPublisher _eventPublisher,
    IOrderActivityRepository _activityRepo,
    IPromotionRepository _promotionRepo,
    PromotionLogic _promotionLogic,
    IOptions<SepayOptions> sepayOptions)
{
    private readonly SepayOptions _sepay = sepayOptions.Value;
    private const int MaxActivities = 100;

    public async Task<PagedResponse<OrderSummaryResponse>> GetPagedAsync(
        GetOrdersRequest req, CancellationToken ct = default)
    {
        OrderInputValidator.ValidatePagination(req.Page, req.PageSize);
        var (items, total) = await _orderRepo.GetPagedAsync(
            req.Search, req.CustomerId, req.Status, req.Channel,
            req.ExcludeChannel, req.CodTab,
            req.Page, req.PageSize, ct);

        var dtos = items.Select(MapToSummary).ToList();
        return new PagedResponse<OrderSummaryResponse>(
            dtos, req.Page, req.PageSize, total,
            (int)Math.Ceiling((double)total / req.PageSize));
    }

    public async Task<OrderResponse> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        return await MapToResponseAsync(order, ct);
    }

    public async Task<OrderResponse> GetByCodeAsync(string code, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new OrderValidationException("Mã đơn hàng không được để trống.");
        var order = await _orderRepo.GetByCodeAsync(code.Trim().ToUpperInvariant(), ct)
            ?? throw new OrderNotFoundByCodeException(code);
        return await MapToResponseAsync(order, ct);
    }

    public async Task<List<OrderActivityResponse>> GetActivitiesAsync(Guid orderId, CancellationToken ct = default)
    {
        _ = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);

        var items = await _activityRepo.GetByOrderIdAsync(orderId, MaxActivities, ct);
        return items.Select(MapActivity).ToList();
    }

    public async Task<OrderResponse> CreateAsync(
        CreateOrderRequest req, Guid? actorId = null, string? actorName = null, CancellationToken ct = default)
    {
        var detailInputs = req.Items.Select(i => new CreateOrderDetailInput(
            i.SkuId, i.SkuSnapshotName.Trim(), i.SkuSnapshotCode?.Trim(),
            i.Quantity, i.UnitPrice)).ToList();

        OrderInputValidator.ValidateCreateOrder(
            detailInputs, req.DiscountAmount, req.PaidAmount,
            req.OrderChannel, req.ShippingAddress);

        var orderCode = await _codeGen.GenerateAsync(ct);
        var totalAmount = detailInputs.Sum(i => i.UnitPrice * i.Quantity);
        var manualDiscount = req.DiscountAmount;
        if (manualDiscount > totalAmount)
            throw new OrderValidationException("Giảm giá thủ công không được lớn hơn tổng tiền đơn hàng.");

        var promotionItems = detailInputs.Select(i => new PromotionCalculationItem(
            i.SkuId,
            i.Quantity,
            i.UnitPrice,
            i.UnitPrice * i.Quantity)).ToList();
        var promotionDiscount = await _promotionLogic.ValidateAndCalculateDiscountAsync(
            req.PromotionId, req.PromotionCode, promotionItems, manualDiscount, req.CustomerId, ct);
        var totalDiscount = manualDiscount + promotionDiscount.DiscountAmount;
        var finalAmount = Math.Max(0, totalAmount - totalDiscount);

        var isPosCashCompleted = req.OrderChannel == OrderChannel.POS
            && req.PaymentMethod == PaymentMethod.Cash;

        var isPosRecordedTransferCompleted = req.OrderChannel == OrderChannel.POS
            && req.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer
            && req.PaidAmount > 0;

        var isPosCompletedOnCreate = isPosCashCompleted || isPosRecordedTransferCompleted;

        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderCode = orderCode,
            CustomerId = req.CustomerId,
            CustomerSnapshotName = req.CustomerSnapshotName?.Trim(),
            EmployeeId = req.EmployeeId,
            OrderChannel = req.OrderChannel,
            OrderStatus = isPosCompletedOnCreate ? OrderStatus.Completed : OrderStatus.PendingPayment,
            InventorySyncStatus = InventorySyncStatus.PendingDeduction,
            TotalAmount = totalAmount,
            DiscountAmount = totalDiscount,
            PromotionId = promotionDiscount.PromotionId,
            PromotionCode = promotionDiscount.PromotionCode,
            PromotionDiscountAmount = promotionDiscount.DiscountAmount,
            FinalAmount = finalAmount,
            ShippingAddress = req.ShippingAddress?.Trim(),
            Note = req.Note?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        order.OrderDetails = detailInputs.Select(i => new OrderDetail
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            SkuId = i.SkuId,
            SkuSnapshotName = i.SkuSnapshotName,
            SkuSnapshotCode = i.SkuSnapshotCode,
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            SubTotal = i.UnitPrice * i.Quantity,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        }).ToList();

        var debtAmount = req.PaymentMethod == PaymentMethod.COD
            ? finalAmount
            : Math.Max(0, finalAmount - req.PaidAmount);

        var paymentAmount = req.PaidAmount;
        if (paymentAmount <= 0
            && req.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer
            && req.TransferQrAmount > 0)
        {
            paymentAmount = req.TransferQrAmount;
        }

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            PaymentMethod = req.PaymentMethod,
            Amount = paymentAmount,
            PaymentStatus = req.PaymentMethod == PaymentMethod.COD
                ? PaymentStatus.Pending
                : (req.PaidAmount >= finalAmount ? PaymentStatus.Success : PaymentStatus.Pending),
            IsCodVerified = false,
            CodWarningDate = req.PaymentMethod == PaymentMethod.COD
                ? DateTime.UtcNow.AddDays(7)
                : null,
            CodDebtSettlementJson = req.PaymentMethod == PaymentMethod.COD
                ? string.IsNullOrWhiteSpace(req.CodDebtSettlementJson) ? null : req.CodDebtSettlementJson.Trim()
                : null,
            PaidAt = null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        if (payment.PaymentStatus == PaymentStatus.Success && req.PaymentMethod != PaymentMethod.COD)
            payment.PaidAt = DateTime.UtcNow;

        if (payment.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer
            && payment.PaymentStatus == PaymentStatus.Pending)
        {
            var expiryMinutes = _sepay.PosVaDurationSeconds > 0
                ? Math.Max(1, _sepay.PosVaDurationSeconds / 60)
                : 15;
            payment.TransferQrExpiresAtUtc = DateTime.UtcNow.AddMinutes(expiryMinutes);
        }

        order.Payments = [payment];

        await _orderRepo.AddAsync(order, ct);

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Created,
            $"Tạo đơn {order.OrderCode} qua kênh {GetChannelLabel(order.OrderChannel)}. Thành tiền {FormatVnd(finalAmount)}.",
            actorId,
            actorName,
            ct);

        if (payment.PaymentStatus == PaymentStatus.Success)
        {
            await RecordActivityAsync(
                order.Id,
                OrderActivityType.PaymentReceived,
                $"Đã thanh toán {FormatVnd(payment.Amount)} qua {GetPaymentMethodLabel(payment.PaymentMethod)}.",
                actorId,
                actorName,
                ct);
        }
        else
        {
            await RecordActivityAsync(
                order.Id,
                OrderActivityType.PaymentPending,
                $"Chờ thanh toán qua {GetPaymentMethodLabel(payment.PaymentMethod)}.",
                actorId,
                actorName,
                ct);
        }

        if (order.OrderStatus == OrderStatus.Completed)
        {
            await RecordActivityAsync(
                order.Id,
                OrderActivityType.Completed,
                "Hoàn tất đơn hàng.",
                actorId,
                actorName,
                ct);
        }

        await _orderRepo.SaveChangesAsync(ct);

        await _eventPublisher.PublishOrderPlacedAsync(
            order.Id, order.OrderCode, order.OrderStatus.ToString(), finalAmount,
            order.OrderDetails.Select(d => (d.SkuId, d.SkuSnapshotName, d.SkuSnapshotCode, d.Quantity)),
            ct);

        if (order.OrderStatus == OrderStatus.Completed && order.CustomerId.HasValue)
            await PublishOrderCompletedAsync(order, debtAmount, ct);

        return await MapToResponseAsync(order, ct);
    }

    public async Task<OrderResponse> UpdateAsync(
        Guid id, UpdateOrderRequest req, Guid? actorId = null, string? actorName = null, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);

        if (order.OrderStatus == OrderStatus.Completed || order.OrderStatus == OrderStatus.Cancelled)
            throw new OrderCannotBeModifiedException(id, order.OrderStatus.ToString());

        order.ShippingAddress = req.ShippingAddress?.Trim();
        order.Note = req.Note?.Trim();
        order.DiscountAmount = req.DiscountAmount;
        order.FinalAmount = Math.Max(0, order.TotalAmount - req.DiscountAmount);
        order.UpdatedAt = DateTime.UtcNow;

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Updated,
            "Cập nhật thông tin đơn (địa chỉ, ghi chú hoặc giảm giá).",
            actorId,
            actorName,
            ct);

        await _orderRepo.SaveChangesAsync(ct);
        return await MapToResponseAsync(order, ct);
    }

    public async Task CancelAsync(
        Guid id, string? reason = null, Guid? actorId = null, string? actorName = null, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);

        if (order.OrderStatus == OrderStatus.Completed || order.OrderStatus == OrderStatus.Cancelled)
            throw new OrderCannotBeCancelledException(id, order.OrderStatus.ToString());

        order.OrderStatus = OrderStatus.Cancelled;
        order.InventorySyncStatus = InventorySyncStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;

        var description = string.IsNullOrWhiteSpace(reason)
            ? "Hủy đơn hàng."
            : $"Hủy đơn hàng. Lý do: {reason.Trim()}";

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Cancelled,
            description,
            actorId,
            actorName,
            ct);

        await _orderRepo.SaveChangesAsync(ct);

        await _eventPublisher.PublishOrderCancelledAsync(
            order.Id, order.OrderCode,
            (order.OrderDetails ?? []).Select(d => (d.SkuId, d.Quantity)),
            ct);
    }

    public async Task MarkShippingAsync(
        Guid id, Guid? actorId = null, string? actorName = null, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);

        if (order.OrderStatus != OrderStatus.Processing && order.OrderStatus != OrderStatus.PendingPayment)
            throw new OrderCannotBeModifiedException(id, order.OrderStatus.ToString());

        var payments = order.Payments ?? [];
        var pendingTransfer = payments.FirstOrDefault(p =>
            p.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer
            && p.PaymentStatus != PaymentStatus.Success);
        if (pendingTransfer is not null)
            throw new OrderValidationException("Đơn chuyển khoản phải thanh toán trước khi chuyển sang đang giao.");

        order.OrderStatus = OrderStatus.Shipping;
        order.UpdatedAt = DateTime.UtcNow;

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Shipped,
            "Chuyển sang trạng thái đang giao hàng.",
            actorId,
            actorName,
            ct);

        await _orderRepo.SaveChangesAsync(ct);
    }

    public async Task CompleteAsync(
        Guid id, Guid? actorId = null, string? actorName = null, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);

        if (order.OrderStatus == OrderStatus.Cancelled || order.OrderStatus == OrderStatus.Completed)
            throw new OrderCannotBeModifiedException(id, order.OrderStatus.ToString());

        order.OrderStatus = OrderStatus.Completed;
        order.UpdatedAt = DateTime.UtcNow;

        var payments = order.Payments ?? await GetPaymentsInternal(order.Id, ct);
        foreach (var payment in payments)
        {
            if (payment.PaymentStatus == PaymentStatus.Success) continue;

            if (payment.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer or PaymentMethod.Cash)
            {
                payment.PaymentStatus = PaymentStatus.Success;
                payment.Amount = order.FinalAmount;
                payment.PaidAt = DateTime.UtcNow;
                payment.UpdatedAt = DateTime.UtcNow;

                var paymentDescription = string.IsNullOrWhiteSpace(payment.TransactionRef)
                    ? $"Đã thanh toán {FormatVnd(order.FinalAmount)} qua {GetPaymentMethodLabel(payment.PaymentMethod)}."
                    : $"Đã thanh toán {FormatVnd(order.FinalAmount)} qua {GetPaymentMethodLabel(payment.PaymentMethod)}. Mã GD: {payment.TransactionRef}.";

                await RecordActivityAsync(
                    order.Id,
                    OrderActivityType.PaymentReceived,
                    paymentDescription,
                    actorId,
                    actorName,
                    ct);
            }
        }

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Completed,
            "Hoàn tất đơn hàng.",
            actorId,
            actorName,
            ct);

        await _orderRepo.SaveChangesAsync(ct);

        await _eventPublisher.PublishOrderPlacedAsync(
            order.Id, order.OrderCode, OrderStatus.Completed.ToString(), order.FinalAmount,
            (order.OrderDetails ?? []).Select(d => (d.SkuId, d.SkuSnapshotName, d.SkuSnapshotCode, d.Quantity)),
            ct);

        if (order.CustomerId.HasValue)
        {
            var paidAmount = payments.Where(p => p.PaymentStatus == PaymentStatus.Success).Sum(p => p.Amount);
            var debtAmount = Math.Max(0, order.FinalAmount - paidAmount);
            await PublishOrderCompletedAsync(order, debtAmount, ct);
        }
    }

    public async Task MarkInventorySyncedAsync(Guid orderId, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);

        if (order.InventorySyncStatus == InventorySyncStatus.Synced)
            return;

        order.InventorySyncStatus = InventorySyncStatus.Synced;
        order.UpdatedAt = DateTime.UtcNow;

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.InventorySynced,
            "Đã trừ tồn kho thành công.",
            actorId: null,
            actorName: "Hệ thống",
            ct);

        await _orderRepo.SaveChangesAsync(ct);
    }

    private async Task PublishOrderCompletedAsync(Order order, decimal debtAmount, CancellationToken ct)
    {
        if (!order.CustomerId.HasValue) return;

        await _eventPublisher.PublishOrderCompletedAsync(
            order.Id, order.OrderCode, order.CustomerId.Value,
            order.FinalAmount, debtAmount,
            (order.OrderDetails ?? []).Select(d => (d.SkuId, d.Quantity)),
            ct);
    }

    private async Task<List<Payment>> GetPaymentsInternal(Guid orderId, CancellationToken ct)
        => await _paymentRepo.GetByOrderIdAsync(orderId, ct);

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

    private static OrderActivityResponse MapActivity(OrderActivity activity) => new(
        activity.Id,
        activity.OrderId,
        activity.ActivityType.ToString(),
        activity.Description,
        activity.ActorId,
        activity.ActorName,
        activity.CreatedAt);

    private async Task<OrderResponse> MapToResponseAsync(Order o, CancellationToken ct)
    {
        Promotion? promotion = null;
        if (o.PromotionId.HasValue)
            promotion = await _promotionRepo.GetByIdAsync(o.PromotionId.Value, ct);

        return MapToResponse(o, promotion);
    }

    private static OrderResponse MapToResponse(Order o, Promotion? promotion = null) => new(
        o.Id, o.OrderCode, o.CustomerId, o.CustomerSnapshotName,
        o.EmployeeId, o.OrderChannel.ToString(), o.OrderStatus.ToString(),
        o.InventorySyncStatus.ToString(), o.TotalAmount, o.DiscountAmount,
        o.PromotionId, o.PromotionCode, o.PromotionDiscountAmount,
        promotion?.ScopeType.ToString(), MapPromotionScopes(promotion),
        o.FinalAmount,
        o.ShippingAddress, o.Note, o.CreatedAt, o.UpdatedAt,
        (o.OrderDetails ?? []).Select(d => new OrderDetailResponse(
            d.Id, d.SkuId, d.SkuSnapshotName, d.SkuSnapshotCode,
            d.Quantity, d.UnitPrice, d.SubTotal)).ToList(),
        (o.Payments ?? []).Select(p => new PaymentResponse(
            p.Id, p.OrderId, o.OrderCode, o.CustomerSnapshotName,
            p.PaymentMethod.ToString(), p.Amount, p.PaymentStatus.ToString(),
            p.TransactionRef, p.IsCodVerified, p.CodWarningDate, p.PaidAt, p.CodDebtSettlementJson)).ToList()
    );

    private static OrderSummaryResponse MapToSummary(Order o)
    {
        var codPayment = o.Payments?.FirstOrDefault(p => p.PaymentMethod == PaymentMethod.COD);
        return new(
            o.Id, o.OrderCode, o.CustomerId, o.CustomerSnapshotName,
            o.OrderChannel.ToString(), o.OrderStatus.ToString(),
            o.InventorySyncStatus.ToString(), o.FinalAmount, o.CreatedAt,
            codPayment?.Id,
            codPayment?.IsCodVerified,
            codPayment?.CodWarningDate,
            codPayment is { IsCodVerified: false } && codPayment.Amount > 0
                ? codPayment.Amount
                : null);
    }

    private static List<PromotionScopeResponse> MapPromotionScopes(Promotion? promotion) =>
        promotion?.ScopeType == PromotionScopeType.SKU
            ? promotion.Scopes
                .Where(s => s.ScopeType == PromotionScopeType.SKU && s.SkuId.HasValue)
                .Select(s => new PromotionScopeResponse(
                    s.SkuId!.Value,
                    s.SkuCode,
                    s.SkuSnapshotName))
                .ToList()
            : [];

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

    private static string GetChannelLabel(OrderChannel channel) => channel switch
    {
        OrderChannel.POS => "bán tại quầy",
        OrderChannel.Website => "website",
        OrderChannel.Zalo => "Zalo",
        OrderChannel.Phone => "điện thoại",
        OrderChannel.COD => "COD",
        _ => channel.ToString()
    };

    private static string GetPaymentMethodLabel(PaymentMethod method) => method switch
    {
        PaymentMethod.Cash => "tiền mặt",
        PaymentMethod.VietQR => "VietQR",
        PaymentMethod.BankTransfer => "chuyển khoản",
        PaymentMethod.COD => "COD",
        _ => method.ToString()
    };
}
