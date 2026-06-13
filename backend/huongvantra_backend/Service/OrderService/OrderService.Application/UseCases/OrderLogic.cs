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
    IReturnOrderRepository _returnOrderRepo,
    IPaymentRepository _paymentRepo,
    IOrderCodeGenerator _codeGen,
    IOrderEventPublisher _eventPublisher,
    IOrderActivityRepository _activityRepo,
    PromotionLogic _promotionLogic,
    IProductCatalogClient _productCatalogClient,
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
            req.ExcludeChannel, req.CodTab, req.ReturnableOnly,
            req.OrderKind, req.ExcludeOrderKind,
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
        if (await RepairInconsistentPaymentsAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        if (await RepairMissingPosTierDiscountAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<OrderResponse> GetByCodeAsync(string code, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new OrderValidationException("Mã đơn hàng không được để trống.");
        var order = await _orderRepo.GetByCodeAsync(code.Trim().ToUpperInvariant(), ct)
            ?? throw new OrderNotFoundByCodeException(code);
        if (await RepairInconsistentPaymentsAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        if (await RepairMissingPosTierDiscountAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<List<OrderActivityResponse>> GetActivitiesAsync(Guid orderId, CancellationToken ct = default)
    {
        _ = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);

        var items = await _activityRepo.GetByOrderIdAsync(orderId, MaxActivities, ct);
        return items.Select(MapActivity).ToList();
    }

    public async Task<PagedResponse<ReturnOrderSummaryResponse>> GetReturnsPagedAsync(
        string? search, string? sourceChannel, int page, int pageSize, CancellationToken ct = default)
    {
        OrderInputValidator.ValidatePagination(page, pageSize);
        var (items, total) = await _returnOrderRepo.GetPagedAsync(search, sourceChannel, page, pageSize, ct);
        var dtos = new List<ReturnOrderSummaryResponse>(items.Count);

        foreach (var (item, sourceOrderChannel) in items)
        {
            string? exchangeCode = null;
            if (item.ExchangeOrderId.HasValue)
                exchangeCode = await _returnOrderRepo.GetExchangeOrderCodeAsync(item.ExchangeOrderId.Value, ct);

            dtos.Add(MapReturnSummary(item, sourceOrderChannel, exchangeCode));
        }

        return new PagedResponse<ReturnOrderSummaryResponse>(
            dtos, page, pageSize, total,
            (int)Math.Ceiling((double)total / pageSize));
    }

    public async Task<ReturnOrderDetailResponse> GetReturnByIdAsync(Guid id, CancellationToken ct = default)
    {
        var item = await _returnOrderRepo.GetByIdAsync(id, ct)
            ?? throw new ReturnOrderNotFoundException(id);

        var sourceOrder = await _orderRepo.GetByIdAsync(item.SourceOrderId, ct);
        var sourceChannel = sourceOrder?.OrderChannel ?? OrderChannel.POS;

        string? exchangeCode = null;
        if (item.ExchangeOrderId.HasValue)
            exchangeCode = await _returnOrderRepo.GetExchangeOrderCodeAsync(item.ExchangeOrderId.Value, ct);

        return MapReturnDetail(item, sourceChannel, exchangeCode);
    }

    public async Task<List<ReturnOrderSummaryResponse>> GetReturnsByOrderIdAsync(
        Guid orderId, CancellationToken ct = default)
    {
        var sourceOrder = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);

        var items = await _returnOrderRepo.GetBySourceOrderIdAsync(orderId, ct);
        var dtos = new List<ReturnOrderSummaryResponse>(items.Count);

        foreach (var item in items)
        {
            string? exchangeCode = null;
            if (item.ExchangeOrderId.HasValue)
                exchangeCode = await _returnOrderRepo.GetExchangeOrderCodeAsync(item.ExchangeOrderId.Value, ct);

            dtos.Add(MapReturnSummary(item, sourceOrder.OrderChannel, exchangeCode));
        }

        return dtos;
    }

    public async Task<OrderResponse> CreateAsync(
        CreateOrderRequest req, Guid? actorId = null, string? actorName = null, CancellationToken ct = default)
    {
        var detailInputs = req.Items.Select(i => new CreateOrderDetailInput(
            i.SkuId, i.SkuSnapshotName.Trim(), i.SkuSnapshotCode?.Trim(),
            i.Quantity, i.UnitPrice, i.CategoryId)).ToList();

        OrderInputValidator.ValidateCreateOrder(
            detailInputs, req.DiscountAmount, req.PaidAmount,
            req.OrderChannel, req.ShippingAddress);

        var orderCode = await _codeGen.GenerateAsync(req.OrderKind, ct);
        var totalAmount = detailInputs.Sum(i => i.UnitPrice * i.Quantity);
        var manualDiscount = req.DiscountAmount;
        if (manualDiscount > totalAmount)
            throw new OrderValidationException("Giảm giá thủ công không được lớn hơn tổng tiền đơn hàng.");

        var hasPromotion = (req.PromotionId.HasValue && req.PromotionId.Value != Guid.Empty) ||
            !string.IsNullOrWhiteSpace(req.PromotionCode);
        if (hasPromotion)
            detailInputs = await EnrichCategoryIdsAsync(detailInputs, ct);

        var promotionItems = detailInputs.Select(i => new PromotionCalculationItem(
            i.SkuId,
            i.Quantity,
            i.UnitPrice,
            i.UnitPrice * i.Quantity,
            i.CategoryId)).ToList();
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
            OrderKind = req.OrderKind,
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

        var isPosRecordedPayment = isPosCompletedOnCreate
            && req.PaymentMethod != PaymentMethod.COD
            && (req.PaidAmount > 0 || finalAmount <= 0);

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            PaymentMethod = req.PaymentMethod,
            Amount = paymentAmount,
            PaymentStatus = req.PaymentMethod == PaymentMethod.COD
                ? PaymentStatus.Pending
                : isPosRecordedPayment || req.PaidAmount >= finalAmount
                    ? PaymentStatus.Success
                    : PaymentStatus.Pending,
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
            order.OrderKind == OrderKind.Exchange
                ? $"Tạo đơn đổi hàng {order.OrderCode}. Thành tiền {FormatVnd(finalAmount)}."
                : $"Tạo đơn {order.OrderCode} qua kênh {GetChannelLabel(order.OrderChannel)}. Thành tiền {FormatVnd(finalAmount)}.",
            actorId,
            actorName,
            ct);

        if (payment.PaymentStatus == PaymentStatus.Success)
        {
            var paymentNote = debtAmount > 0
                ? $"Đã thu {FormatVnd(payment.Amount)} qua {GetPaymentMethodLabel(payment.PaymentMethod)}. Còn nợ {FormatVnd(debtAmount)}."
                : $"Đã thanh toán {FormatVnd(payment.Amount)} qua {GetPaymentMethodLabel(payment.PaymentMethod)}.";
            await RecordActivityAsync(
                order.Id,
                OrderActivityType.PaymentReceived,
                paymentNote,
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

        return MapToResponse(order);
    }

    private async Task<List<CreateOrderDetailInput>> EnrichCategoryIdsAsync(
        List<CreateOrderDetailInput> items,
        CancellationToken ct)
    {
        var categoryBySkuId = new Dictionary<Guid, int?>();
        foreach (var skuId in items.Select(i => i.SkuId).Distinct())
            categoryBySkuId[skuId] = await _productCatalogClient.GetSkuCategoryIdAsync(skuId, ct);

        return items
            .Select(item =>
                categoryBySkuId.TryGetValue(item.SkuId, out var resolvedCategoryId) &&
                resolvedCategoryId.HasValue
                    ? item with { CategoryId = resolvedCategoryId.Value }
                    : item)
            .ToList();
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
        return MapToResponse(order);
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

        var payments = order.Payments ?? await GetPaymentsInternal(order.Id, ct);
        foreach (var payment in payments)
        {
            if (payment.PaymentStatus != PaymentStatus.Success)
            {
                payment.PaymentStatus = PaymentStatus.Failed;
                payment.UpdatedAt = DateTime.UtcNow;
            }
        }

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

    public async Task<ReturnOrderResponse> ReturnAsync(
        Guid orderId,
        ReturnOrderRequest req,
        Guid? actorId = null,
        string? actorName = null,
        CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);

        if (order.OrderStatus != OrderStatus.Completed)
            throw new OrderValidationException("Chỉ trả hàng trên hóa đơn đã hoàn tất.");

        var returnInputs = (req.Items ?? []).Where(i => i.ReturnQuantity > 0).ToList();
        if (returnInputs.Count == 0)
            throw new OrderValidationException("Chọn ít nhất một dòng hàng để trả.");

        var detailById = (order.OrderDetails ?? []).ToDictionary(d => d.Id);
        var returnLines = new List<(OrderDetail Detail, int Quantity)>();

        foreach (var input in returnInputs)
        {
            if (!detailById.TryGetValue(input.OrderDetailId, out var detail))
                throw new OrderValidationException($"Dòng hàng không thuộc đơn {order.OrderCode}.");

            var remaining = detail.Quantity - detail.ReturnedQuantity;
            if (input.ReturnQuantity > remaining)
                throw new OrderValidationException(
                    $"Số lượng trả vượt quá còn lại ({remaining}) cho {detail.SkuSnapshotName}.");

            returnLines.Add((detail, input.ReturnQuantity));
        }

        var returnAmount = returnLines.Sum(x => x.Detail.UnitPrice * x.Quantity);
        var exchangeItems = (req.ExchangeItems ?? []).Where(i => i.Quantity > 0).ToList();
        var exchangeAmount = exchangeItems.Sum(i => i.UnitPrice * i.Quantity);
        var netCustomerPays = exchangeAmount - returnAmount;
        var refundAmount = netCustomerPays < 0 ? Math.Abs(netCustomerPays) : 0m;
        var customerPaid = Math.Max(0, req.CustomerPaidAmount);
        var refundMethod = MapReturnPaymentMethod(req.PaymentMethod);
        var payExtraDeferred = netCustomerPays > 0
            && refundMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer;

        if (netCustomerPays > 0 && !payExtraDeferred && customerPaid + 0.01m < netCustomerPays)
            throw new OrderValidationException($"Khách cần trả thêm {FormatVnd(netCustomerPays)}.");

        var returnId = Guid.NewGuid();
        var returnCode = await _returnOrderRepo.GenerateReturnCodeAsync(ct);
        var now = DateTime.UtcNow;

        var returnOrder = new ReturnOrder
        {
            Id = returnId,
            ReturnCode = returnCode,
            SourceOrderId = order.Id,
            SourceOrderCode = order.OrderCode,
            CustomerId = order.CustomerId,
            CustomerSnapshotName = order.CustomerSnapshotName,
            ReturnAmount = returnAmount,
            ExchangeAmount = exchangeAmount,
            NetCustomerPays = netCustomerPays,
            RefundAmount = refundAmount,
            CustomerPaidAmount = customerPaid,
            RefundMethod = refundMethod,
            Note = req.Note?.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
            Details = returnLines.Select(x => new ReturnOrderDetail
            {
                Id = Guid.NewGuid(),
                ReturnOrderId = returnId,
                SourceOrderDetailId = x.Detail.Id,
                SkuId = x.Detail.SkuId,
                SkuSnapshotName = x.Detail.SkuSnapshotName,
                SkuSnapshotCode = x.Detail.SkuSnapshotCode,
                ReturnQuantity = x.Quantity,
                UnitPrice = x.Detail.UnitPrice,
                SubTotal = x.Detail.UnitPrice * x.Quantity,
                CreatedAt = now,
                UpdatedAt = now
            }).ToList()
        };

        foreach (var (detail, qty) in returnLines)
        {
            detail.ReturnedQuantity += qty;
            detail.UpdatedAt = now;
        }

        await _returnOrderRepo.AddAsync(returnOrder, ct);

        var returnDescription = refundAmount > 0
            ? $"Trả hàng {returnCode}: hoàn {FormatVnd(refundAmount)} qua {GetPaymentMethodLabel(refundMethod)}."
            : exchangeAmount > 0
                ? $"Trả hàng {returnCode}: đổi/mua thêm, khách trả thêm {FormatVnd(netCustomerPays)}."
                : $"Trả hàng {returnCode}: hoàn {FormatVnd(returnAmount)}.";

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Returned,
            returnDescription,
            actorId,
            actorName,
            ct);

        await _returnOrderRepo.SaveChangesAsync(ct);

        await _eventPublisher.PublishOrderReturnedAsync(
            returnId,
            order.Id,
            order.OrderCode,
            returnLines.Select(x => (x.Detail.SkuId, x.Quantity)),
            ct);

        string? exchangeOrderCode = null;
        Guid? exchangeOrderId = null;

        if (exchangeItems.Count > 0)
        {
            var exchangeDiscount = Math.Min(returnAmount, exchangeAmount);
            var exchangeChannel = OrderChannel.POS;
            var exchangePaymentMethod = refundMethod;
            var isExchangeTransferQr = netCustomerPays > 0
                && exchangePaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer;
            var exchangePaidAmount = isExchangeTransferQr ? 0m : customerPaid;
            var exchangeTransferQrAmount = isExchangeTransferQr ? netCustomerPays : 0m;

            var exchangeOrder = await CreateAsync(
                new CreateOrderRequest(
                    order.CustomerId,
                    order.CustomerSnapshotName,
                    order.EmployeeId ?? actorId,
                    exchangeChannel,
                    null,
                    $"Đổi hàng từ {order.OrderCode} ({returnCode})",
                    exchangeDiscount,
                    exchangeItems.Select(i => new CreateOrderDetailRequest(
                        i.SkuId,
                        i.SkuSnapshotName.Trim(),
                        i.SkuSnapshotCode?.Trim(),
                        i.Quantity,
                        i.UnitPrice)).ToList(),
                    exchangePaymentMethod,
                    exchangePaidAmount,
                    exchangeTransferQrAmount,
                    null,
                    null,
                    null,
                    OrderKind.Exchange),
                actorId,
                actorName,
                ct);

            exchangeOrderId = exchangeOrder.Id;
            exchangeOrderCode = exchangeOrder.OrderCode;

            var persistedExchange = await _orderRepo.GetByIdAsync(exchangeOrder.Id, ct);
            if (persistedExchange != null && persistedExchange.OrderKind != OrderKind.Exchange)
            {
                persistedExchange.OrderKind = OrderKind.Exchange;
                persistedExchange.UpdatedAt = DateTime.UtcNow;
                await _orderRepo.SaveChangesAsync(ct);
            }

            returnOrder.ExchangeOrderId = exchangeOrderId;
            returnOrder.UpdatedAt = DateTime.UtcNow;
            await _returnOrderRepo.SaveChangesAsync(ct);
        }

        return new ReturnOrderResponse(
            returnId,
            returnCode,
            order.Id,
            order.OrderCode,
            returnAmount,
            exchangeAmount,
            netCustomerPays,
            refundAmount,
            exchangeOrderId,
            exchangeOrderCode);
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

    private static ReturnOrderSummaryResponse MapReturnSummary(
        ReturnOrder item, OrderChannel sourceChannel, string? exchangeCode) => new(
        item.Id,
        item.ReturnCode,
        item.SourceOrderId,
        item.SourceOrderCode,
        sourceChannel.ToString(),
        item.CustomerId,
        item.CustomerSnapshotName,
        item.ReturnAmount,
        item.RefundAmount,
        item.ExchangeAmount,
        item.ExchangeOrderId,
        exchangeCode,
        item.CreatedAt);

    private static ReturnOrderDetailResponse MapReturnDetail(
        ReturnOrder item, OrderChannel sourceChannel, string? exchangeCode) => new(
        item.Id,
        item.ReturnCode,
        item.SourceOrderId,
        item.SourceOrderCode,
        sourceChannel.ToString(),
        item.CustomerId,
        item.CustomerSnapshotName,
        item.ReturnAmount,
        item.ExchangeAmount,
        item.NetCustomerPays,
        item.RefundAmount,
        item.CustomerPaidAmount,
        item.RefundMethod.ToString(),
        item.ExchangeOrderId,
        exchangeCode,
        item.Note,
        item.CreatedAt,
        (item.Details ?? []).Select(d => new ReturnOrderLineResponse(
            d.Id,
            d.SkuId,
            d.SkuSnapshotName,
            d.SkuSnapshotCode,
            d.ReturnQuantity,
            d.UnitPrice,
            d.SubTotal)).ToList());

    private static OrderActivityResponse MapActivity(OrderActivity activity) => new(
        activity.Id,
        activity.OrderId,
        activity.ActivityType.ToString(),
        activity.Description,
        activity.ActorId,
        activity.ActorName,
        activity.CreatedAt);

    private async Task<bool> RepairInconsistentPaymentsAsync(Order order, CancellationToken ct)
    {
        if (order.OrderStatus != OrderStatus.Completed) return false;

        var payments = order.Payments ?? await GetPaymentsInternal(order.Id, ct);
        var changed = false;

        foreach (var payment in payments)
        {
            if (payment.PaymentMethod == PaymentMethod.COD) continue;
            if (payment.PaymentStatus == PaymentStatus.Success) continue;

            var shouldBeSuccess = order.OrderChannel == OrderChannel.POS
                ? payment.Amount > 0 || order.FinalAmount <= 0
                : payment.Amount >= order.FinalAmount && order.FinalAmount > 0;

            if (!shouldBeSuccess) continue;

            payment.PaymentStatus = PaymentStatus.Success;
            payment.PaidAt ??= payment.UpdatedAt == default ? DateTime.UtcNow : payment.UpdatedAt;
            payment.UpdatedAt = DateTime.UtcNow;
            changed = true;
        }

        return changed;
    }

    /// <summary>
    /// Đơn POS cũ: POS đã áp CK hạng nhưng backend chưa lưu vào DiscountAmount → FinalAmount lớn hơn số đã thu.
    /// </summary>
    private static Task<bool> RepairMissingPosTierDiscountAsync(Order order, CancellationToken ct)
    {
        _ = ct;
        if (order.OrderChannel != OrderChannel.POS || order.OrderStatus != OrderStatus.Completed)
            return Task.FromResult(false);

        var payment = order.Payments?.FirstOrDefault(p =>
            p.PaymentMethod == PaymentMethod.Cash && p.PaymentStatus == PaymentStatus.Success);
        if (payment is null || payment.Amount <= 0 || payment.Amount >= order.FinalAmount)
            return Task.FromResult(false);

        var gap = order.FinalAmount - payment.Amount;
        if (gap <= 0 || gap >= order.FinalAmount * 0.2m)
            return Task.FromResult(false);

        if (order.PromotionDiscountAmount > 0)
            return Task.FromResult(false);

        if (order.DiscountAmount > 0 && order.DiscountAmount != gap)
            return Task.FromResult(false);

        order.DiscountAmount = gap;
        order.FinalAmount = payment.Amount;
        order.UpdatedAt = DateTime.UtcNow;
        return Task.FromResult(true);
    }

    private static OrderResponse MapToResponse(Order o) => new(
        o.Id, o.OrderCode, o.CustomerId, o.CustomerSnapshotName,
        o.EmployeeId, o.OrderChannel.ToString(), o.OrderKind.ToString(), o.OrderStatus.ToString(),
        o.InventorySyncStatus.ToString(), o.TotalAmount, o.DiscountAmount,
        o.PromotionId, o.PromotionCode, o.PromotionDiscountAmount, o.FinalAmount,
        o.ShippingAddress, o.Note, o.CreatedAt, o.UpdatedAt,
        (o.OrderDetails ?? []).Select(d => new OrderDetailResponse(
            d.Id, d.SkuId, d.SkuSnapshotName, d.SkuSnapshotCode,
            d.Quantity, d.ReturnedQuantity, d.UnitPrice, d.SubTotal)).ToList(),
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
            o.OrderChannel.ToString(), o.OrderKind.ToString(), o.OrderStatus.ToString(),
            o.InventorySyncStatus.ToString(), o.FinalAmount, o.CreatedAt,
            o.Note,
            codPayment?.Id,
            codPayment?.IsCodVerified,
            codPayment?.CodWarningDate,
            codPayment is { IsCodVerified: false } && codPayment.Amount > 0
                ? codPayment.Amount
                : null);
    }

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

    private static PaymentMethod MapReturnPaymentMethod(string? raw)
    {
        var value = raw?.Trim().ToUpperInvariant() ?? string.Empty;
        return value switch
        {
            "TRANSFER" or "VIETQR" or "BANKTRANSFER" => PaymentMethod.VietQR,
            "COD" => PaymentMethod.COD,
            _ => PaymentMethod.Cash
        };
    }

    private static string GetPaymentMethodLabel(PaymentMethod method) => method switch
    {
        PaymentMethod.Cash => "tiền mặt",
        PaymentMethod.VietQR => "VietQR",
        PaymentMethod.BankTransfer => "chuyển khoản",
        PaymentMethod.COD => "COD",
        _ => method.ToString()
    };
}
