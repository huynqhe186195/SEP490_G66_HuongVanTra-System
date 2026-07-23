using System.Globalization;
using Microsoft.Extensions.Options;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Application.Validation;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;
using OrderService.Domain.Rules;

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
    ICustomerCatalogClient _customerCatalogClient,
    IInventoryCatalogClient _inventoryCatalogClient,
    ICustomBundleRepository _customBundleRepo,
    IEmailService _emailService,
    IOptions<SepayOptions> sepayOptions)
{
    private readonly SepayOptions _sepay = sepayOptions.Value;
    private const int MaxActivities = 100;

    public async Task<PagedResponse<OrderSummaryResponse>> GetPagedAsync(
        GetOrdersRequest req, OrderAccessContext access, CancellationToken ct = default)
    {
        var page = ParsePositiveInt(req.Page, 1);
        var pageSize = Math.Clamp(ParsePositiveInt(req.PageSize, 20), 1, 1000);
        OrderInputValidator.ValidatePagination(page, pageSize);

        var customerId = ParseOptionalGuid(req.CustomerId);
        var employeeFilter = access.EmployeeFilter ?? ParseOptionalGuid(req.EmployeeId);
        var fromDate = ParseOptionalDate(req.FromDate);
        var toDate = ParseOptionalDate(req.ToDate);
        var channel = access.CodOrdersOnly ? "COD" : req.Channel;
        var excludeChannel = access.CodOrdersOnly ? null : req.ExcludeChannel;

        var (items, total) = await _orderRepo.GetPagedAsync(
            req.Search, customerId, req.Status, channel,
            excludeChannel, req.CodTab, req.ReturnableOnly,
            req.OrderKind, req.ExcludeOrderKind,
            fromDate, toDate, employeeFilter, access.IncludeAllCodOrders,
            page, pageSize, ct);

        var dtos = items.Select(MapToSummary).ToList();
        return new PagedResponse<OrderSummaryResponse>(
            dtos, page, pageSize, total,
            (int)Math.Ceiling((double)total / pageSize));
    }

    private static int ParsePositiveInt(string? value, int fallback)
    {
        return int.TryParse(value, out var parsed) && parsed > 0 ? parsed : fallback;
    }

    private static Guid? ParseOptionalGuid(string? value)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text))
            return null;
        return Guid.TryParse(text, out var id) ? id : null;
    }

    private static DateTime? ParseOptionalDate(string? value)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text))
            return null;
        return DateTime.TryParse(text, null, System.Globalization.DateTimeStyles.RoundtripKind, out var parsed)
            ? parsed
            : null;
    }

    private static bool IsOtherReturnReason(string value)
    {
        var text = value.Trim();
        return text.Equals("OTHER", StringComparison.OrdinalIgnoreCase)
            || text.Contains("khác", StringComparison.OrdinalIgnoreCase)
            || text.Contains("khac", StringComparison.OrdinalIgnoreCase);
    }

    private static string BuildReturnNote(ReturnOrderRequest req)
    {
        var reasons = (req.Reasons ?? [])
            .Select(reason => reason?.Trim())
            .Where(reason => !string.IsNullOrWhiteSpace(reason))
            .Select(reason => reason!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (reasons.Count == 0)
            throw new OrderValidationException("Vui lòng chọn ít nhất một lý do trả/đổi hàng.");

        var hasOtherReason = reasons.Any(IsOtherReturnReason);
        var otherReason = req.OtherReason?.Trim();
        if (hasOtherReason && (otherReason?.Length ?? 0) < 10)
            throw new OrderValidationException("Vui lòng nhập lý do khác ít nhất 10 ký tự.");

        var displayReasons = reasons
            .Select(reason => IsOtherReturnReason(reason) ? "Lý do khác" : reason)
            .ToList();

        var parts = new List<string> { $"Lý do: {string.Join("; ", displayReasons)}" };

        if (hasOtherReason && !string.IsNullOrWhiteSpace(otherReason))
            parts.Add($"Chi tiết khác: {otherReason}");

        var note = req.Note?.Trim();
        if (!string.IsNullOrWhiteSpace(note))
            parts.Add($"Ghi chú: {note}");

        return string.Join(" | ", parts);
    }

    public async Task<OrderResponse> GetByIdAsync(Guid id, OrderAccessContext access, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        EnsureCanAccess(order, access);
        if (await RepairInconsistentPaymentsAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        if (await RepairMissingPosTierDiscountAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<OrderResponse> GetByCodeAsync(string code, OrderAccessContext access, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new OrderValidationException("Mã đơn hàng không được để trống.");
        var order = await _orderRepo.GetByCodeAsync(code.Trim().ToUpperInvariant(), ct)
            ?? throw new OrderNotFoundByCodeException(code);
        EnsureCanAccess(order, access);
        if (await RepairInconsistentPaymentsAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        if (await RepairMissingPosTierDiscountAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<List<OrderActivityResponse>> GetActivitiesAsync(
        Guid orderId, OrderAccessContext access, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);
        EnsureCanAccess(order, access);

        var items = await _activityRepo.GetByOrderIdAsync(orderId, MaxActivities, ct);
        return items.Select(MapActivity).ToList();
    }

    public async Task<PagedResponse<ReturnOrderSummaryResponse>> GetReturnsPagedAsync(
        string? search, string? sourceChannel, OrderAccessContext access, int page, int pageSize, CancellationToken ct = default)
    {
        OrderInputValidator.ValidatePagination(page, pageSize);
        var channel = access.CodOrdersOnly ? "COD" : sourceChannel;
        var (items, total) = await _returnOrderRepo.GetPagedAsync(
            search, channel, access.EmployeeFilter, access.IncludeAllCodOrders, page, pageSize, ct);
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

    public async Task<ReturnOrderDetailResponse> GetReturnByIdAsync(
        Guid id, OrderAccessContext access, CancellationToken ct = default)
    {
        var item = await _returnOrderRepo.GetByIdAsync(id, ct)
            ?? throw new ReturnOrderNotFoundException(id);

        var sourceOrder = await _orderRepo.GetByIdAsync(item.SourceOrderId, ct)
            ?? throw new OrderNotFoundException(item.SourceOrderId);
        EnsureCanAccess(sourceOrder, access);
        var sourceChannel = sourceOrder?.OrderChannel ?? OrderChannel.POS;

        string? exchangeCode = null;
        if (item.ExchangeOrderId.HasValue)
            exchangeCode = await _returnOrderRepo.GetExchangeOrderCodeAsync(item.ExchangeOrderId.Value, ct);

        return MapReturnDetail(item, sourceChannel, exchangeCode);
    }

    public async Task<List<ReturnOrderSummaryResponse>> GetReturnsByOrderIdAsync(
        Guid orderId, OrderAccessContext access, CancellationToken ct = default)
    {
        var sourceOrder = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);
        EnsureCanAccess(sourceOrder, access);

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
        CreateOrderRequest req,
        OrderAccessContext access,
        Guid? actorId = null,
        string? actorName = null,
        string? idempotencyKey = null,
        CancellationToken ct = default)
    {
        var effectiveIdempotencyKey = OrderIdempotency.BuildActorScopedKey(idempotencyKey, actorId);
        if (effectiveIdempotencyKey is not null)
        {
            var existing = await _orderRepo.GetByIdempotencyKeyAsync(effectiveIdempotencyKey, ct);
            if (existing != null)
                return MapToResponse(existing);
        }

        var skuProfiles = await GetRequiredSkuProfilesAsync(
            req.Items.Select(i => i.SkuId),
            ct);
        var detailInputs = req.Items.Select(i =>
        {
            var profile = skuProfiles[i.SkuId];
            var isGift = i.IsGift;
            var unitPrice = isGift ? 0m : i.UnitPrice;
            return new CreateOrderDetailInput(
                i.SkuId,
                i.SkuSnapshotName.Trim(),
                i.SkuSnapshotCode?.Trim(),
                i.CategorySnapshotName?.Trim(),
                OrderBusinessRules.NormalizeBaseQuantity(i.Quantity, profile.InventoryUnit),
                i.CostPrice,
                unitPrice,
                isGift,
                profile.CategoryId ?? i.CategoryId);
        }).ToList();

        OrderInputValidator.ValidateCreateOrder(
            detailInputs, req.DiscountAmount, req.PaidAmount,
            req.OrderChannel, req.ShippingAddress,
            hasCustomBundles: (req.CustomBundles ?? []).Any(b => (b.Ingredients ?? []).Count > 0));

        if (req.OrderKind != OrderKind.Exchange)
        {
            OrderBusinessRules.EnsureSaleLinesHavePositivePrice(
                detailInputs.Select(item => (item.UnitPrice, item.IsGift)));
        }

        var hasGiftItems = detailInputs.Any(i => i.IsGift);
        if (hasGiftItems)
            await EnsureVipCustomerAsync(req.CustomerId, ct);
        var isAuthorizedVipGiftOrder =
            hasGiftItems
            && detailInputs.All(item => item.IsGift)
            && !(req.CustomBundles ?? []).Any(bundle => (bundle.Ingredients ?? []).Count > 0);

        // Exchange: DiscountAmount includes return credit (+ tier/manual already validated in ReturnAsync).
        // Do not treat that credit as a VIP/manual POS discount.
        if (req.DiscountAmount > 0 && req.OrderKind != OrderKind.Exchange)
            await EnsureManualDiscountAllowedAsync(req.CustomerId, ct);

        var totalAmount = detailInputs.Sum(i => i.UnitPrice * i.Quantity);
        var bundleTotal = (req.CustomBundles ?? []).Sum(b => b.Ingredients.Sum(i => i.UnitPrice * i.Quantity));
        totalAmount += bundleTotal;
        var manualDiscount = req.DiscountAmount;
        if (req.OrderKind != OrderKind.Exchange)
        {
            OrderBusinessRules.EnsureManualDiscountDoesNotZeroOrder(totalAmount, manualDiscount);
        }
        if (manualDiscount > totalAmount)
            throw new OrderValidationException("Giảm giá thủ công không được lớn hơn tổng tiền đơn hàng.");

        var promotionItems = detailInputs.Select(i => new PromotionCalculationItem(
            i.SkuId,
            i.Quantity,
            i.UnitPrice,
            i.UnitPrice * i.Quantity,
            i.CategoryId)).ToList();
        var promotionDiscount = await _promotionLogic.ValidateAndCalculateDiscountAsync(
            req.PromotionId, req.PromotionCode, promotionItems, manualDiscount, req.CustomerId, ct);
        var membershipDiscount = req.OrderKind == OrderKind.Exchange
            ? 0m
            : await GetMembershipTierDiscountAsync(
                req.CustomerId,
                Math.Max(0, totalAmount - manualDiscount - promotionDiscount.DiscountAmount),
                ct);
        var totalDiscount = manualDiscount + promotionDiscount.DiscountAmount + membershipDiscount;
        var finalAmount = Math.Max(0, totalAmount - totalDiscount);
        if (req.OrderKind != OrderKind.Exchange)
        {
            OrderBusinessRules.EnsureZeroTotalOrderAllowed(
                finalAmount,
                totalAmount,
                manualDiscount,
                promotionDiscount.PromotionId,
                promotionDiscount.DiscountAmount,
                isAuthorizedVipGiftOrder);
        }
        var paymentAllocations = NormalizePaymentAllocations(req, finalAmount);
        var allocatedPaymentTotal = paymentAllocations.Sum(item => item.Amount);
        OrderBusinessRules.EnsureGuestFullyPaid(
            req.CustomerId,
            allocatedPaymentTotal,
            finalAmount);
        var orderCode = await _codeGen.GenerateAsync(req.OrderKind, ct);

        var hasPendingTransfer = paymentAllocations.Any(item =>
            item.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer
            && item.PaymentStatus != PaymentStatus.Success);
        var hasCodPayment = paymentAllocations.Any(item => item.PaymentMethod == PaymentMethod.COD);
        var hasRecordedPayment = paymentAllocations.Any(item => item.PaymentStatus == PaymentStatus.Success);
        var isPosCompletedOnCreate =
            req.OrderChannel == OrderChannel.POS
            && !hasPendingTransfer
            && !hasCodPayment
            && (finalAmount <= 0 || hasRecordedPayment || req.PaymentMethod == PaymentMethod.Cash);

        var ownerId = access.CanViewAllOrders ? (req.EmployeeId ?? actorId) : actorId;
        if (!access.CanViewAllOrders
            && req.EmployeeId.HasValue
            && actorId.HasValue
            && req.EmployeeId.Value != actorId.Value)
        {
            throw new OrderForbiddenException();
        }

        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderCode = orderCode,
            CustomerId = req.CustomerId,
            CustomerSnapshotName = req.CustomerSnapshotName?.Trim(),
            EmployeeId = ownerId,
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
            IdempotencyKey = effectiveIdempotencyKey,
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
            CategorySnapshotName = i.CategorySnapshotName,
            Quantity = i.Quantity,
            CostPrice = i.CostPrice,
            UnitPrice = i.UnitPrice,
            SubTotal = i.UnitPrice * i.Quantity,
            IsGift = i.IsGift,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        }).ToList();

        var now = DateTime.UtcNow;
        order.CustomBundles = (req.CustomBundles ?? []).Select(b => new CustomBundle
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            Label = b.Label?.Trim(),
            Note = b.Note?.Trim(),
            TotalPrice = b.Ingredients.Sum(i => i.UnitPrice * i.Quantity),
            PackingStatus = PackingStatus.Pending,
            Ingredients = b.Ingredients.Select(i => new CustomBundleIngredient
            {
                Id = Guid.NewGuid(),
                MaterialSkuId = i.MaterialSkuId,
                MaterialSkuCode = i.MaterialSkuCode,
                MaterialSnapshotName = i.MaterialSnapshotName,
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
                SubTotal = i.UnitPrice * i.Quantity,
                CreatedAt = now,
                UpdatedAt = now
            }).ToList(),
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();

        var successfulPaymentTotal = paymentAllocations
            .Where(item => item.PaymentStatus == PaymentStatus.Success)
            .Sum(item => item.Amount);
        var debtAmount = hasCodPayment
            ? finalAmount
            : Math.Max(0, finalAmount - successfulPaymentTotal);

        var paymentCreatedAt = DateTime.UtcNow;
        var payments = paymentAllocations.Select(item =>
        {
            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                PaymentMethod = item.PaymentMethod,
                Amount = item.Amount,
                PaymentStatus = item.PaymentStatus,
                IsCodVerified = false,
                CodWarningDate = item.PaymentMethod == PaymentMethod.COD
                    ? paymentCreatedAt.AddDays(7)
                    : null,
                CodDebtSettlementJson = item.DebtSettlementJson,
                PaidAt = item.PaymentStatus == PaymentStatus.Success
                    ? paymentCreatedAt
                    : null,
                CreatedAt = paymentCreatedAt,
                UpdatedAt = paymentCreatedAt
            };

            if (item.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer
                && item.PaymentStatus == PaymentStatus.Pending)
            {
                var expiryMinutes = _sepay.PosVaDurationSeconds > 0
                    ? Math.Max(1, _sepay.PosVaDurationSeconds / 60)
                    : 15;
                payment.TransferQrExpiresAtUtc = paymentCreatedAt.AddMinutes(expiryMinutes);
            }

            return payment;
        }).ToList();

        order.Payments = payments;

        await _orderRepo.AddAsync(order, ct);

        if (effectiveIdempotencyKey is not null)
        {
            try
            {
                // Persist the unique claim before any stock or event side effect.
                await _orderRepo.SaveChangesAsync(ct);
            }
            catch (DuplicateOrderIdempotencyKeyException)
            {
                var existing = await _orderRepo.GetByIdempotencyKeyAsync(effectiveIdempotencyKey, ct);
                if (existing is not null)
                    return MapToResponse(existing);

                throw;
            }
        }

        InventoryStockHandlingResponse? stockHandling = null;
        if (ShouldHandlePosStockSynchronously(order))
        {
            stockHandling = await PreparePosStockHandlingAsync(order, ct);
            order.InventorySyncStatus = stockHandling.HasPendingStockReconciliation
                ? InventorySyncStatus.PendingReconciliation
                : InventorySyncStatus.Synced;
        }

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Created,
            order.OrderKind == OrderKind.Exchange
                ? $"Tạo đơn đổi hàng {order.OrderCode}. Thành tiền {FormatVnd(finalAmount)}."
                : $"Tạo đơn {order.OrderCode} qua kênh {GetChannelLabel(order.OrderChannel)}. Thành tiền {FormatVnd(finalAmount)}.",
            actorId,
            actorName,
            ct);

        foreach (var payment in payments)
        {
            if (payment.PaymentStatus == PaymentStatus.Success)
            {
                await RecordActivityAsync(
                    order.Id,
                    OrderActivityType.PaymentReceived,
                    $"Đã ghi nhận {FormatVnd(payment.Amount)} qua {GetPaymentMethodLabel(payment.PaymentMethod)}.",
                    actorId,
                    actorName,
                    ct);
            }
            else
            {
                await RecordActivityAsync(
                    order.Id,
                    OrderActivityType.PaymentPending,
                    $"Chờ {FormatVnd(payment.Amount)} qua {GetPaymentMethodLabel(payment.PaymentMethod)}.",
                    actorId,
                    actorName,
                    ct);
            }
        }

        if (payments.Count == 0 && finalAmount > 0)
        {
            await RecordActivityAsync(
                order.Id,
                OrderActivityType.PaymentPending,
                $"Chưa thu tiền. Còn nợ {FormatVnd(debtAmount)}.",
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

        if (stockHandling != null)
        {
            await RecordActivityAsync(
                order.Id,
                OrderActivityType.InventorySynced,
                stockHandling.Message,
                actorId,
                actorName,
                ct);
        }

        await _orderRepo.SaveChangesAsync(ct);

        if (!ShouldSuppressLegacyOrderPlacedEvent(order))
        {
            await _eventPublisher.PublishOrderPlacedAsync(
                order.Id, order.OrderCode, order.OrderStatus.ToString(), finalAmount,
                order.OrderDetails.Select(d => (d.SkuId, d.SkuSnapshotName, d.SkuSnapshotCode, d.Quantity)),
                ct);
        }

        if (order.OrderStatus == OrderStatus.Completed && order.CustomerId.HasValue)
            await PublishOrderCompletedAsync(order, debtAmount, ct);

        return MapToResponse(order, MapStockHandlingSummary(stockHandling));
    }

    private static List<NormalizedPaymentAllocation> NormalizePaymentAllocations(
        CreateOrderRequest request,
        decimal finalAmount)
    {
        if (request.Payments is { Count: > 0 })
        {
            if (finalAmount <= 0)
                throw new OrderValidationException("Đơn 0 đồng hợp lệ không được tạo bản ghi thanh toán 0 đồng.");

            if (request.Payments.Any(item => item.Amount <= 0))
                throw new OrderValidationException("Mỗi khoản thanh toán phải lớn hơn 0.");

            if (request.Payments.Any(item => !Enum.IsDefined(item.PaymentMethod)))
                throw new OrderValidationException("Phương thức thanh toán không hợp lệ.");

            if (request.Payments
                .GroupBy(item => item.PaymentMethod)
                .Any(group => group.Count() > 1))
            {
                throw new OrderValidationException(
                    "Mỗi phương thức thanh toán chỉ được xuất hiện một lần trong cùng đơn hàng.");
            }

            var transferCount = request.Payments.Count(item =>
                item.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer);
            var hasCod = request.Payments.Any(item => item.PaymentMethod == PaymentMethod.COD);
            if (request.Payments.Count > 2
                || transferCount > 1
                || (request.Payments.Count == 2
                    && (!request.Payments.Any(item => item.PaymentMethod == PaymentMethod.Cash)
                        || transferCount != 1))
                || (hasCod && request.Payments.Count != 1))
            {
                throw new OrderValidationException(
                    "Chỉ hỗ trợ tiền mặt, chuyển khoản/VietQR, COD riêng lẻ hoặc kết hợp tiền mặt với một khoản chuyển khoản.");
            }

            if (request.Payments.Count(item => !string.IsNullOrWhiteSpace(item.DebtSettlementJson)) > 1)
                throw new OrderValidationException("Chỉ được khai báo một yêu cầu thu công nợ trong mỗi lần thanh toán.");

            if (!request.CustomerId.HasValue
                && request.Payments.Any(item => !string.IsNullOrWhiteSpace(item.DebtSettlementJson)))
            {
                throw new OrderValidationException("Chỉ khách hàng đã đăng ký mới được thanh toán công nợ.");
            }

            var total = request.Payments.Sum(item => item.Amount);
            if (total > finalAmount)
                throw new OrderValidationException("Tổng các khoản thanh toán không được vượt quá thành tiền.");
            if (hasCod && total != finalAmount)
                throw new OrderValidationException("Khoản COD phải bằng đúng thành tiền của đơn.");

            return request.Payments.Select(item => new NormalizedPaymentAllocation(
                item.PaymentMethod,
                item.Amount,
                item.PaymentMethod == PaymentMethod.Cash
                    ? PaymentStatus.Success
                    : PaymentStatus.Pending,
                string.IsNullOrWhiteSpace(item.DebtSettlementJson)
                    ? null
                    : item.DebtSettlementJson.Trim())).ToList();
        }

        if (finalAmount <= 0)
        {
            if (request.PaidAmount > 0 || request.TransferQrAmount > 0)
                throw new OrderValidationException("Đơn 0 đồng hợp lệ không cần khoản thanh toán.");
            return [];
        }

        if (request.PaymentMethod == PaymentMethod.COD)
        {
            return
            [
                new NormalizedPaymentAllocation(
                    PaymentMethod.COD,
                    finalAmount,
                    PaymentStatus.Pending,
                    string.IsNullOrWhiteSpace(request.CodDebtSettlementJson)
                        ? null
                        : request.CodDebtSettlementJson.Trim())
            ];
        }

        if (!Enum.IsDefined(request.PaymentMethod))
            throw new OrderValidationException("Phương thức thanh toán không hợp lệ.");

        var requestedAmount = request.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer
            && request.PaidAmount <= 0
                ? request.TransferQrAmount
                : request.PaidAmount;
        if (requestedAmount <= 0)
            return [];
        // Legacy callers may send cash tendered (including change) via PaidAmount.
        // Persist only the amount applied to the order, matching Payments[] semantics.
        var amount = Math.Min(requestedAmount, finalAmount);

        var isRecordedTransfer =
            request.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer
            && request.PaidAmount > 0
            && (request.OrderChannel == OrderChannel.POS || request.PaidAmount >= finalAmount);
        var status = request.PaymentMethod == PaymentMethod.Cash
            ? request.OrderChannel == OrderChannel.POS || request.PaidAmount >= finalAmount
                ? PaymentStatus.Success
                : PaymentStatus.Pending
            : isRecordedTransfer
                ? PaymentStatus.Success
                : PaymentStatus.Pending;

        return
        [
            new NormalizedPaymentAllocation(
                request.PaymentMethod,
                amount,
                status,
                null)
        ];
    }

    private sealed record NormalizedPaymentAllocation(
        PaymentMethod PaymentMethod,
        decimal Amount,
        PaymentStatus PaymentStatus,
        string? DebtSettlementJson);

    private async Task EnsureVipCustomerAsync(Guid? customerId, CancellationToken ct)
    {
        if (!customerId.HasValue || customerId == Guid.Empty)
            throw new OrderValidationException(
                "Quà tặng và chiết khấu thủ công chỉ áp dụng cho khách đối ngoại (VIP). Vui lòng chọn khách VIP.");

        var customer = await _customerCatalogClient.GetCustomerAsync(customerId.Value, ct);
        if (customer is null || !customer.IsVipCustomer)
            throw new OrderValidationException(
                "Quà tặng và chiết khấu thủ công chỉ dành cho khách đối ngoại (VIP).");
    }

    private async Task EnsureManualDiscountAllowedAsync(Guid? customerId, CancellationToken ct)
    {
        if (!customerId.HasValue || customerId == Guid.Empty)
        {
            OrderBusinessRules.EnsureManualDiscountAllowed(1m, null);
            return;
        }

        var customer = await _customerCatalogClient.GetCustomerAsync(customerId.Value, ct);
        OrderBusinessRules.EnsureManualDiscountAllowed(
            1m,
            customer?.CustomerGroup,
            customer?.TierId);
    }

    private async Task ApplyOrderDetailUpdatesAsync(
        Order order, List<UpdateOrderDetailRequest> items, CancellationToken ct)
    {
        await EnsureVipCustomerAsync(order.CustomerId, ct);

        order.OrderDetails ??= new List<OrderDetail>();
        var existingById = order.OrderDetails.ToDictionary(d => d.Id);
        var skuProfiles = await GetRequiredSkuProfilesAsync(
            items.Select(i => i.SkuId),
            ct);
        var now = DateTime.UtcNow;

        foreach (var reqItem in items)
        {
            var profile = skuProfiles[reqItem.SkuId];
            var quantity = OrderBusinessRules.NormalizeBaseQuantity(
                reqItem.Quantity,
                profile.InventoryUnit);
            if (reqItem.Quantity < 1)
                throw new OrderValidationException("Số lượng sản phẩm phải >= 1.");

            if (reqItem.Id.HasValue && reqItem.Id != Guid.Empty)
            {
                if (!existingById.TryGetValue(reqItem.Id.Value, out var detail))
                    throw new OrderValidationException("Dòng đơn hàng không tồn tại.");

                if (quantity < detail.ReturnedQuantity)
                    throw new OrderValidationException(
                        $"Số lượng không thể nhỏ hơn số đã trả ({detail.ReturnedQuantity}).");

                var unitPrice = reqItem.IsGift ? 0m : reqItem.UnitPrice;
                if (!reqItem.IsGift && unitPrice < 0)
                    throw new OrderValidationException("Đơn giá không được âm.");

                detail.SkuSnapshotName = reqItem.SkuSnapshotName.Trim();
                detail.SkuSnapshotCode = reqItem.SkuSnapshotCode?.Trim();
                detail.CategorySnapshotName = reqItem.CategorySnapshotName?.Trim();
                detail.Quantity = quantity;
                detail.CostPrice = reqItem.CostPrice;
                detail.UnitPrice = unitPrice;
                detail.SubTotal = unitPrice * quantity;
                detail.IsGift = reqItem.IsGift;
                detail.UpdatedAt = now;
                continue;
            }

            if (!reqItem.IsGift)
                throw new OrderValidationException("Chỉ được thêm dòng quà tặng khi cập nhật đơn VIP.");

            var giftLine = new OrderDetail
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                SkuId = reqItem.SkuId,
                SkuSnapshotName = reqItem.SkuSnapshotName.Trim(),
                SkuSnapshotCode = reqItem.SkuSnapshotCode?.Trim(),
                CategorySnapshotName = reqItem.CategorySnapshotName?.Trim(),
                Quantity = quantity,
                CostPrice = reqItem.CostPrice,
                UnitPrice = 0m,
                SubTotal = 0m,
                IsGift = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            order.OrderDetails.Add(giftLine);
        }

        order.TotalAmount = order.OrderDetails.Sum(d => d.SubTotal);
        order.UpdatedAt = now;
    }

    private async Task<Dictionary<Guid, ProductSkuCatalogProfile>> GetRequiredSkuProfilesAsync(
        IEnumerable<Guid> skuIds,
        CancellationToken ct)
    {
        var submittedIds = skuIds
            .Distinct()
            .ToList();
        if (submittedIds.Any(id => id == Guid.Empty))
            throw new OrderValidationException("SkuId sản phẩm không hợp lệ.");

        var targetIds = submittedIds;
        var profiles = (await _productCatalogClient.GetSkuProfilesAsync(targetIds, ct))
            .ToDictionary(profile => profile.SkuId);
        var missingIds = targetIds.Where(id => !profiles.ContainsKey(id)).ToList();
        if (missingIds.Count > 0)
            throw new OrderValidationException(
                "Không xác minh được đơn vị tồn kho của một hoặc nhiều sản phẩm. Vui lòng tải lại danh mục và thử lại.");

        return profiles;
    }

    public async Task<OrderResponse> UpdateAsync(
        Guid id, UpdateOrderRequest req, OrderAccessContext access, Guid? actorId = null, string? actorName = null, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        EnsureCanAccess(order, access);

        if (order.OrderStatus == OrderStatus.Completed || order.OrderStatus == OrderStatus.Cancelled)
            throw new OrderCannotBeModifiedException(id, order.OrderStatus.ToString());

        if (req.Items is { Count: > 0 })
            await ApplyOrderDetailUpdatesAsync(order, req.Items, ct);

        var manualDiscount = Math.Max(0, req.DiscountAmount);
        if (manualDiscount > 0)
            await EnsureManualDiscountAllowedAsync(order.CustomerId, ct);

        if (manualDiscount > order.TotalAmount)
            throw new OrderValidationException("Giảm giá thủ công không được lớn hơn tạm tính.");

        var promotionItems = (order.OrderDetails ?? [])
            .Select(d => new PromotionCalculationItem(d.SkuId, d.Quantity, d.UnitPrice, d.SubTotal))
            .ToList();

        Guid? promotionId = order.PromotionId;
        string? promotionCode = order.PromotionCode;
        if (req.PromotionId.HasValue)
        {
            if (req.PromotionId.Value == Guid.Empty)
            {
                promotionId = null;
                promotionCode = null;
            }
            else
            {
                promotionId = req.PromotionId;
                promotionCode = null;
            }
        }
        else if (req.PromotionCode is not null)
        {
            var trimmedCode = req.PromotionCode.Trim();
            if (string.IsNullOrEmpty(trimmedCode))
            {
                promotionId = null;
                promotionCode = null;
            }
            else
            {
                promotionId = null;
                promotionCode = trimmedCode;
            }
        }

        var promotionDiscount = await _promotionLogic.ValidateAndCalculateDiscountAsync(
            promotionId,
            promotionCode,
            promotionItems,
            manualDiscount,
            order.CustomerId,
            ct);

        var membershipDiscount = await GetMembershipTierDiscountAsync(
            order.CustomerId,
            Math.Max(0, order.TotalAmount - manualDiscount - promotionDiscount.DiscountAmount),
            ct);
        var totalDiscount = manualDiscount + promotionDiscount.DiscountAmount + membershipDiscount;
        if (totalDiscount > order.TotalAmount)
            throw new OrderValidationException("Tổng giảm giá (thủ công + khuyến mãi) không được lớn hơn tạm tính.");

        order.ShippingAddress = req.ShippingAddress?.Trim();
        order.Note = req.Note?.Trim();
        order.DiscountAmount = totalDiscount;
        order.PromotionId = promotionDiscount.PromotionId;
        order.PromotionCode = promotionDiscount.PromotionCode;
        order.PromotionDiscountAmount = promotionDiscount.DiscountAmount;
        order.FinalAmount = Math.Max(0, order.TotalAmount - totalDiscount);
        order.UpdatedAt = DateTime.UtcNow;

        var payments = order.Payments ?? await GetPaymentsInternal(order.Id, ct);
        var successfulAmount = payments
            .Where(payment => payment.PaymentStatus == PaymentStatus.Success)
            .Sum(payment => payment.Amount);
        var remainingAmount = Math.Max(0, order.FinalAmount - successfulAmount);
        var pendingPayments = payments
            .Where(payment => payment.PaymentStatus == PaymentStatus.Pending)
            .ToList();
        if (pendingPayments.Count > 0 && remainingAmount > 0)
        {
            pendingPayments[0].Amount = remainingAmount;
            pendingPayments[0].UpdatedAt = DateTime.UtcNow;
            foreach (var extraPayment in pendingPayments.Skip(1))
            {
                extraPayment.PaymentStatus = PaymentStatus.Failed;
                extraPayment.UpdatedAt = DateTime.UtcNow;
            }
        }
        else if (remainingAmount <= 0)
        {
            foreach (var pendingPayment in pendingPayments)
            {
                pendingPayment.PaymentStatus = PaymentStatus.Failed;
                pendingPayment.UpdatedAt = DateTime.UtcNow;
            }
        }

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Updated,
            req.Items is { Count: > 0 }
                ? $"Cập nhật đơn: sản phẩm/địa chỉ/ghi chú/giảm giá. Thành tiền mới {FormatVnd(order.FinalAmount)}."
                : $"Cập nhật đơn: địa chỉ/ghi chú/giảm giá. Thành tiền mới {FormatVnd(order.FinalAmount)}.",
            actorId,
            actorName,
            ct);

        await _orderRepo.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task CancelAsync(
        Guid id, OrderAccessContext access, string? reason = null, Guid? actorId = null, string? actorName = null, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        EnsureCanAccess(order, access);

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
        Guid id, OrderAccessContext access, Guid? actorId = null, string? actorName = null, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        EnsureCanAccess(order, access);

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
        Guid id, OrderAccessContext access, Guid? actorId = null, string? actorName = null,
        decimal? actualReceivedAmount = null, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        EnsureCanAccess(order, access);

        if (order.OrderStatus == OrderStatus.Cancelled || order.OrderStatus == OrderStatus.Completed)
            throw new OrderCannotBeModifiedException(id, order.OrderStatus.ToString());

        var payments = order.Payments ?? await GetPaymentsInternal(order.Id, ct);
        var hasPendingTransfer = payments.Any(payment =>
            payment.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer
            && payment.PaymentStatus != PaymentStatus.Success);
        if (hasPendingTransfer && !actualReceivedAmount.HasValue)
        {
            throw new OrderValidationException(
                "Đơn chuyển khoản chỉ được hoàn tất sau khi backend xác nhận giao dịch.");
        }

        order.OrderStatus = OrderStatus.Completed;
        order.UpdatedAt = DateTime.UtcNow;

        foreach (var payment in payments)
        {
            if (payment.PaymentStatus == PaymentStatus.Success) continue;

            if (payment.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer or PaymentMethod.Cash)
            {
                var alreadyPaid = payments
                    .Where(item => item.PaymentStatus == PaymentStatus.Success)
                    .Sum(item => item.Amount);
                var remainingOrderAmount = Math.Max(0, order.FinalAmount - alreadyPaid);
                var configuredAmount = payment.Amount > 0
                    ? Math.Min(payment.Amount, remainingOrderAmount)
                    : remainingOrderAmount;
                var paidNow = (payment.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer)
                    && actualReceivedAmount.HasValue
                    ? Math.Min(actualReceivedAmount.Value, configuredAmount)
                    : configuredAmount;

                payment.PaymentStatus = PaymentStatus.Success;
                payment.Amount = paidNow;
                payment.PaidAt = DateTime.UtcNow;
                payment.UpdatedAt = DateTime.UtcNow;

                var paymentDescription = string.IsNullOrWhiteSpace(payment.TransactionRef)
                    ? $"Đã thanh toán {FormatVnd(paidNow)} qua {GetPaymentMethodLabel(payment.PaymentMethod)}."
                    : $"Đã thanh toán {FormatVnd(paidNow)} qua {GetPaymentMethodLabel(payment.PaymentMethod)}. Mã GD: {payment.TransactionRef}.";

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

        InventoryStockHandlingResponse? stockHandling = null;
        if (ShouldHandlePosStockSynchronously(order))
        {
            stockHandling = await PreparePosStockHandlingAsync(order, ct);
            order.InventorySyncStatus = stockHandling.HasPendingStockReconciliation
                ? InventorySyncStatus.PendingReconciliation
                : InventorySyncStatus.Synced;

            await RecordActivityAsync(
                order.Id,
                OrderActivityType.InventorySynced,
                stockHandling.Message,
                actorId,
                actorName,
                ct);
        }

        await _orderRepo.SaveChangesAsync(ct);

        if (!ShouldSuppressLegacyOrderPlacedEvent(order))
        {
            await _eventPublisher.PublishOrderPlacedAsync(
                order.Id, order.OrderCode, OrderStatus.Completed.ToString(), order.FinalAmount,
                (order.OrderDetails ?? []).Select(d => (d.SkuId, d.SkuSnapshotName, d.SkuSnapshotCode, d.Quantity)),
                ct);
        }

        if (order.CustomerId.HasValue)
        {
            var paidAmount = payments.Where(p => p.PaymentStatus == PaymentStatus.Success).Sum(p => p.Amount);
            var debtAmount = Math.Max(0, order.FinalAmount - paidAmount);
            await PublishOrderCompletedAsync(order, debtAmount, ct);
        }
    }

    public async Task RepublishCompletedCustomerStateAsync(
        Guid orderId,
        CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);
        if (order.OrderStatus != OrderStatus.Completed || !order.CustomerId.HasValue)
            return;

        var paidAmount = (order.Payments ?? [])
            .Where(payment => payment.PaymentStatus == PaymentStatus.Success)
            .Sum(payment => payment.Amount);
        await PublishOrderCompletedEventAsync(
            order,
            Math.Max(0, order.FinalAmount - paidAmount),
            ct);
    }

    public async Task<ReturnOrderResponse> ReturnAsync(
        Guid orderId,
        ReturnOrderRequest req,
        OrderAccessContext access,
        Guid? actorId = null,
        string? actorName = null,
        CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);
        EnsureCanAccess(order, access);

        if (order.OrderStatus != OrderStatus.Completed)
            throw new OrderValidationException("Chỉ trả hàng trên hóa đơn đã hoàn tất.");

        await RepairMissingPosTierDiscountAsync(order, ct);

        var returnInputs = (req.Items ?? []).Where(i => i.ReturnQuantity > 0).ToList();
        if (returnInputs.Count == 0)
            throw new OrderValidationException("Chọn ít nhất một dòng hàng để trả.");

        var returnNote = BuildReturnNote(req);

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

        var paidRatio = GetOrderPaidRatio(order);
        var returnAmount = returnLines.Sum(x =>
            Math.Round(x.Detail.UnitPrice * x.Quantity * paidRatio, 0, MidpointRounding.AwayFromZero));
        var exchangeItems = (req.ExchangeItems ?? []).Where(i => i.Quantity > 0).ToList();
        var exchangeAmount = exchangeItems.Sum(i => i.UnitPrice * i.Quantity);
        var manualExchangeDiscount = Math.Max(0, req.ExchangeManualDiscount);
        if (manualExchangeDiscount > 0)
        {
            if (exchangeItems.Count == 0)
                throw new OrderValidationException("Chiết khấu thủ công chỉ áp dụng khi có hàng đổi.");
            await EnsureVipCustomerAsync(order.CustomerId, ct);
        }

        var membershipDiscount = exchangeItems.Count > 0
            ? await GetMembershipTierDiscountAsync(order.CustomerId, exchangeAmount, ct)
            : 0m;
        var maxManualExchangeDiscount = Math.Max(0, exchangeAmount - membershipDiscount);
        if (manualExchangeDiscount > maxManualExchangeDiscount + 0.01m)
            throw new OrderValidationException(
                $"Chiết khấu thủ công không được vượt {FormatVnd(maxManualExchangeDiscount)}.");

        var exchangePayable = Math.Max(0, exchangeAmount - membershipDiscount - manualExchangeDiscount);
        var netCustomerPays = exchangePayable - returnAmount;
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
            Note = returnNote,
            CreatedAt = now,
            UpdatedAt = now,
            Details = returnLines.Select(x =>
            {
                var effectiveUnit = Math.Round(x.Detail.UnitPrice * paidRatio, 0, MidpointRounding.AwayFromZero);
                var subTotal = Math.Round(effectiveUnit * x.Quantity, 0, MidpointRounding.AwayFromZero);
                return new ReturnOrderDetail
                {
                    Id = Guid.NewGuid(),
                    ReturnOrderId = returnId,
                    SourceOrderDetailId = x.Detail.Id,
                    SkuId = x.Detail.SkuId,
                    SkuSnapshotName = x.Detail.SkuSnapshotName,
                    SkuSnapshotCode = x.Detail.SkuSnapshotCode,
                    ReturnQuantity = x.Quantity,
                    UnitPrice = effectiveUnit,
                    SubTotal = subTotal,
                    CreatedAt = now,
                    UpdatedAt = now
                };
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
            returnCode,
            order.Id,
            order.OrderCode,
            order.CustomerId,
            returnAmount,
            order.FinalAmount,
            refundAmount,
            returnLines.Select(x => (
                x.Detail.SkuId,
                x.Detail.SkuSnapshotName,
                x.Detail.SkuSnapshotCode,
                x.Quantity)),
            ct);

        string? exchangeOrderCode = null;
        Guid? exchangeOrderId = null;

        if (exchangeItems.Count > 0)
        {
            var returnCredit = Math.Min(returnAmount, exchangeAmount);
            var exchangeDiscount = Math.Min(
                exchangeAmount,
                returnCredit + membershipDiscount + manualExchangeDiscount);
            var exchangeChannel = order.OrderChannel;
            var exchangePaymentMethod = refundMethod;
            var isExchangeTransferQr = netCustomerPays > 0
                && exchangePaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer;
            var exchangePaidAmount = isExchangeTransferQr ? 0m : customerPaid;
            var exchangeTransferQrAmount = isExchangeTransferQr ? netCustomerPays : 0m;

            var exchangeOrder = await CreateAsync(
                new CreateOrderRequest(
                    order.CustomerId,
                    order.CustomerSnapshotName,
                    actorId,
                    exchangeChannel,
                    order.ShippingAddress,
                    $"Đổi hàng từ {order.OrderCode} ({returnCode})",
                    exchangeDiscount,
                    exchangeItems.Select(i => new CreateOrderDetailRequest(
                        i.SkuId,
                        i.SkuSnapshotName.Trim(),
                        i.SkuSnapshotCode?.Trim(),
                        i.CategorySnapshotName,
                        i.Quantity,
                        i.CostPrice,
                        i.UnitPrice)).ToList(),
                    exchangePaymentMethod,
                    exchangePaidAmount,
                    exchangeTransferQrAmount,
                    null,
                    null,
                    null,
                    OrderKind.Exchange),
                access,
                actorId,
                actorName,
                null,
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

    public async Task MarkInventoryDeductionCancelledAsync(
        Guid orderId,
        string? reason,
        CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);

        if (order.InventorySyncStatus == InventorySyncStatus.Cancelled)
            return;

        order.InventorySyncStatus = InventorySyncStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;

        var description = string.IsNullOrWhiteSpace(reason)
            ? "Đã hủy trừ tồn kho cho đơn hàng."
            : $"Đã hủy trừ tồn kho cho đơn hàng. Lý do: {reason.Trim()}";

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.InventorySynced,
            description,
            actorId: null,
            actorName: "Hệ thống",
            ct);

        await _orderRepo.SaveChangesAsync(ct);
    }

    private async Task PublishOrderCompletedAsync(Order order, decimal debtAmount, CancellationToken ct)
    {
        if (!order.CustomerId.HasValue) return;

        try
        {
            var customer = await _customerCatalogClient.GetCustomerAsync(order.CustomerId.Value, ct);
            if (customer is not null && !string.IsNullOrWhiteSpace(customer.Email))
            {
                _ = Task.Run(() => _emailService.SendInvoiceEmailAsync(customer.Email, customer.FullName ?? "Quý khách", customer.TierName, order, CancellationToken.None));
            }
        }
        catch
        {
            // Log if needed, but don't prevent the event from being published
        }

        await PublishOrderCompletedEventAsync(order, debtAmount, ct);
    }

    private Task PublishOrderCompletedEventAsync(
        Order order,
        decimal debtAmount,
        CancellationToken ct)
    {
        var debtSettlementJson = (order.Payments ?? [])
            .Select(payment => payment.CodDebtSettlementJson)
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

        return _eventPublisher.PublishOrderCompletedAsync(
            order.Id, order.OrderCode, order.CustomerId.Value,
            order.FinalAmount, debtAmount,
            (order.OrderDetails ?? []).Select(d => (d.SkuId, d.Quantity)),
            debtSettlementJson,
            ct);
    }

    private static bool ShouldHandlePosStockSynchronously(Order order) =>
        order.OrderChannel == OrderChannel.POS
        && order.OrderStatus == OrderStatus.Completed
        && (order.OrderDetails?.Count ?? 0) > 0;

    private static bool ShouldSuppressLegacyOrderPlacedEvent(Order order) =>
        order.OrderChannel == OrderChannel.POS;

    private async Task<InventoryStockHandlingResponse> PreparePosStockHandlingAsync(
        Order order,
        CancellationToken ct)
    {
        try
        {
            return await _inventoryCatalogClient.PreparePosStockDeductionAsync(
                new InventoryStockHandlingRequest(
                    order.Id,
                    order.OrderCode,
                    order.OrderStatus.ToString(),
                    order.FinalAmount,
                    (order.OrderDetails ?? []).Select(d => new InventoryStockHandlingItemRequest(
                        d.SkuId,
                        d.SkuSnapshotName,
                        d.SkuSnapshotCode,
                        d.Quantity)).ToList()),
                ct);
        }
        catch (InventoryStockHandlingException ex)
        {
            throw new OrderValidationException(ex.Message);
        }
    }

    private static StockHandlingSummaryResponse? MapStockHandlingSummary(
        InventoryStockHandlingResponse? response)
    {
        if (response == null) return null;

        return new StockHandlingSummaryResponse(
            response.HasPendingStockReconciliation,
            response.StockHandlingMode,
            response.Message,
            response.Lines.Select(line => new StockHandlingLineResponse(
                line.SkuId,
                line.SkuCode,
                line.SkuName,
                line.OrderedQuantity,
                line.FinishedDeductedQuantity,
                line.PendingBomQuantity)).ToList());
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
        item.CreatedAt,
        item.Note);

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

    private async Task<decimal> GetMembershipTierDiscountAsync(
        Guid? customerId,
        decimal amount,
        CancellationToken ct)
    {
        if (!customerId.HasValue || customerId == Guid.Empty || amount <= 0)
            return 0m;

        var customer = await _customerCatalogClient.GetCustomerAsync(customerId.Value, ct);
        if (customer is null || customer.IsVipCustomer || customer.TierDiscountPercent <= 0)
            return 0m;

        return Math.Round(
            amount * customer.TierDiscountPercent / 100m,
            0,
            MidpointRounding.AwayFromZero);
    }

    private static decimal GetOrderCollectedAmount(Order order)
    {
        var successTotal = (order.Payments ?? [])
            .Where(p => p.PaymentStatus == PaymentStatus.Success)
            .Sum(p => p.Amount);

        if (successTotal > 0)
            return successTotal;

        if (order.OrderStatus == OrderStatus.Completed)
        {
            var posCash = (order.Payments ?? [])
                .Where(p => p.PaymentMethod == PaymentMethod.Cash && p.Amount > 0)
                .Sum(p => p.Amount);
            if (posCash > 0)
                return posCash;
        }

        return order.FinalAmount > 0 ? order.FinalAmount : order.TotalAmount;
    }

    private static decimal GetOrderPaidRatio(Order order)
    {
        if (order.TotalAmount <= 0)
            return 1m;

        var collected = GetOrderCollectedAmount(order);
        var ratio = collected / order.TotalAmount;
        return ratio <= 0 ? 1m : Math.Min(ratio, 1m);
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

    public async Task<PagedResponse<CustomBundleResponse>> GetPendingCustomBundlesAsync(
        int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var (items, total) = await _customBundleRepo.GetPagedByStatusAsync(PackingStatus.Pending, page, pageSize, ct);
        var dtos = items.Select(MapBundle).ToList();
        return new PagedResponse<CustomBundleResponse>(
            dtos, page, pageSize, total,
            (int)Math.Ceiling((double)total / pageSize));
    }

    public async Task<CustomBundleResponse> PackCustomBundleAsync(Guid bundleId, CancellationToken ct = default)
    {
        var bundle = await _customBundleRepo.GetByIdAsync(bundleId, ct)
            ?? throw new OrderNotFoundException(bundleId);

        if (bundle.PackingStatus == PackingStatus.Packed)
            throw new OrderValidationException("Gói này đã được đóng gói.");

        List<(Guid SkuId, string? SkuCode, string? SkuName, int Quantity)> ingredients = bundle.Ingredients
            .Select(i => (
                SkuId: i.MaterialSkuId,
                SkuCode: (string?)i.MaterialSkuCode,
                SkuName: (string?)i.MaterialSnapshotName,
                Quantity: i.Quantity))
            .ToList();
        var referenceCode = !string.IsNullOrWhiteSpace(bundle.Order?.OrderCode)
            ? bundle.Order.OrderCode
            : bundle.Label ?? bundle.Id.ToString("N")[..8];
        await _inventoryCatalogClient.DeductMaterialsAsync(
            ingredients,
            "CustomBundle",
            bundle.Id,
            referenceCode,
            $"Dong goi custom bundle {bundle.Label ?? bundle.Id.ToString("N")[..8]}",
            ct);

        bundle.PackingStatus = PackingStatus.Packed;
        bundle.PackedAt = DateTime.UtcNow;
        bundle.UpdatedAt = DateTime.UtcNow;
        await _customBundleRepo.SaveChangesAsync(ct);

        return MapBundle(bundle);
    }

    private static CustomBundleResponse MapBundle(CustomBundle b) => new(
        b.Id, b.OrderId, b.Label, b.Note, b.TotalPrice,
        b.PackingStatus.ToString(), b.PackedAt,
        (b.Ingredients ?? []).Select(i => new CustomBundleIngredientResponse(
            i.Id, i.MaterialSkuId, i.MaterialSkuCode, i.MaterialSnapshotName,
            i.Quantity, i.UnitPrice, i.SubTotal)).ToList());

    private static OrderResponse MapToResponse(Order o, StockHandlingSummaryResponse? stockHandlingSummary = null) => new(
        o.Id, o.OrderCode, o.CustomerId, o.CustomerSnapshotName,
        o.EmployeeId, o.OrderChannel.ToString(), o.OrderKind.ToString(), o.OrderStatus.ToString(),
        o.InventorySyncStatus.ToString(), o.TotalAmount, o.DiscountAmount,
        o.PromotionId, o.PromotionCode, o.PromotionDiscountAmount, o.FinalAmount,
        o.ShippingAddress, o.Note, o.CreatedAt, o.UpdatedAt,
        (o.OrderDetails ?? []).Select(d => new OrderDetailResponse(
            d.Id, d.SkuId, d.SkuSnapshotName, d.SkuSnapshotCode,
            d.Quantity, d.ReturnedQuantity, d.UnitPrice, d.SubTotal, d.IsGift)).ToList(),
        (o.Payments ?? []).Select(p => new PaymentResponse(
            p.Id, p.OrderId, o.OrderCode, o.CustomerSnapshotName,
            p.PaymentMethod.ToString(), p.Amount, p.PaymentStatus.ToString(),
            p.TransactionRef, p.IsCodVerified, p.CodWarningDate, p.PaidAt, p.CodDebtSettlementJson)).ToList(),
        (o.CustomBundles ?? []).Select(b => new CustomBundleResponse(
            b.Id, b.OrderId, b.Label, b.Note, b.TotalPrice,
            b.PackingStatus.ToString(), b.PackedAt,
            (b.Ingredients ?? []).Select(i => new CustomBundleIngredientResponse(
                i.Id, i.MaterialSkuId, i.MaterialSkuCode, i.MaterialSnapshotName,
                i.Quantity, i.UnitPrice, i.SubTotal)).ToList())).ToList(),
        stockHandlingSummary
    );

    private static OrderSummaryResponse MapToSummary(Order o)
    {
        var codPayment = o.Payments?.FirstOrDefault(p => p.PaymentMethod == PaymentMethod.COD);
        return new(
            o.Id, o.OrderCode, o.CustomerId, o.CustomerSnapshotName,
            o.OrderChannel.ToString(), o.OrderKind.ToString(), o.OrderStatus.ToString(),
            o.InventorySyncStatus.ToString(), o.TotalAmount, o.DiscountAmount, o.FinalAmount, o.CreatedAt,
            o.Note,
            codPayment?.Id,
            codPayment?.IsCodVerified,
            codPayment?.CodWarningDate,
            codPayment is { IsCodVerified: false } && codPayment.Amount > 0 ? codPayment.Amount : null,
            o.OrderDetails?.Sum(d => d.Quantity) ?? 0);
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

    private static void EnsureCanAccess(Order order, OrderAccessContext access)
    {
        if (!access.CanAccessOrder(order))
            throw new OrderForbiddenException();
    }
}
