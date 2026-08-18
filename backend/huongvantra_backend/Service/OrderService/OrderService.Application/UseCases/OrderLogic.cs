using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using HuongVanTra.Shared.Notifications;
using Microsoft.Extensions.Options;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Application.Services;
using OrderService.Application.Validation;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;
using OrderService.Domain.Rules;
using OrderService.Domain.ValueObjects;

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
    IContractCatalogClient _contractCatalogClient,
    IInventoryCatalogClient _inventoryCatalogClient,
    ICustomBundleRepository _customBundleRepo,
    IEmailService _emailService,
    PosCashSessionLogic _posCashSessionLogic,
    StaffShiftGuard _shiftGuard,
    PaymentIdempotencyService _idempotencyService,
    INotificationClient _notificationClient,
    IOptions<SepayOptions> sepayOptions,
    IOptions<BackorderOptions>? backorderOptions = null,
    ReturnPolicyLogic? returnPolicyLogic = null)
{
    private readonly SepayOptions _sepay = sepayOptions.Value;
    private readonly BackorderOptions _backorder = backorderOptions?.Value ?? new BackorderOptions();
    private readonly ReturnPolicyLogic? _returnPolicyLogic = returnPolicyLogic;
    private const int MaxActivities = 100;
    private const int OverdueDepositCancelDays = 7;

    public async Task<PagedResponse<OrderSummaryResponse>> GetPagedAsync(
        GetOrdersRequest req, OrderAccessContext access, CancellationToken ct = default)
    {
        var page = ParsePositiveInt(req.Page, 1);
        var pageSize = Math.Clamp(ParsePositiveInt(req.PageSize, 20), 1, 100);
        OrderInputValidator.ValidatePagination(page, pageSize);

        var customerId = ParseOptionalGuid(req.CustomerId);
        var employeeFilter = access.EmployeeFilter ?? ParseOptionalGuid(req.EmployeeId);
        var fromDate = ParseOptionalDate(req.FromDate);
        var toDate = ParseOptionalDate(req.ToDate);
        var channel = access.CodOrdersOnly ? "COD" : req.Channel;
        var excludeChannel = access.CodOrdersOnly ? null : req.ExcludeChannel;

        // POS-04 (truy vết giữ chỗ): filter "Có hàng đang giữ" lấy tập OrderId từ InventoryService
        // qua service client — không truy vấn chéo database.
        IReadOnlyCollection<Guid>? restrictToOrderIds = null;
        if (req.HasActiveReservation)
        {
            restrictToOrderIds = await _inventoryCatalogClient
                .GetOrderIdsWithActiveReservationAsync([], ct);
        }

        var (items, total) = await _orderRepo.GetPagedAsync(
            req.Search, customerId, req.Status, channel,
            excludeChannel, req.CodTab, req.ReturnableOnly,
            req.OrderKind, req.ExcludeOrderKind,
            fromDate, toDate, employeeFilter, access.IncludeAllCodOrders,
            page, pageSize, ct, restrictToOrderIds);

        var statusCounts = await _orderRepo.CountByStatusAsync(
            req.Search, customerId, channel,
            excludeChannel, req.CodTab, req.ReturnableOnly,
            req.OrderKind, req.ExcludeOrderKind,
            fromDate, toDate, employeeFilter, access.IncludeAllCodOrders,
            ct, restrictToOrderIds);

        var dtos = items.Select(MapToSummary).ToList();

        if (dtos.Count > 0)
        {
            var pageOrderIds = dtos.Select(d => d.Id).ToList();
            HashSet<Guid> reservedIds = restrictToOrderIds != null
                ? [.. pageOrderIds]
                : await _inventoryCatalogClient.GetOrderIdsWithActiveReservationAsync(pageOrderIds, ct);

            if (reservedIds.Count > 0)
            {
                dtos = dtos
                    .Select(d => reservedIds.Contains(d.Id)
                        ? d with { HasActiveStockReservation = true }
                        : d)
                    .ToList();
            }
        }

        return new PagedResponse<OrderSummaryResponse>(
            dtos, page, pageSize, total,
            (int)Math.Ceiling((double)total / pageSize),
            statusCounts);
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
        // Exact match only — do NOT use Contains("khác") (matches "Khách đổi ý").
        return text.Equals("OTHER", StringComparison.OrdinalIgnoreCase)
            || text.Equals("Lý do khác", StringComparison.OrdinalIgnoreCase)
            || text.Equals("Ly do khac", StringComparison.OrdinalIgnoreCase);
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
            .Select(reason =>
            {
                if (IsOtherReturnReason(reason)) return "Lý do khác";
                return reason switch
                {
                    "CUSTOMER_CHANGED_MIND" => "Khách đổi ý",
                    "CUSTOMER_ORDERED_WRONG" => "Khách mua nhầm / mua dư",
                    "DAMAGED" => "Sản phẩm bị lỗi / hư hỏng",
                    "NOT_AS_DESCRIBED" => "Sản phẩm không đúng mô tả / hình ảnh",
                    "WRONG_ITEM" => "Giao sai sản phẩm / sai loại / sai quy cách",
                    "SHIPPING_DAMAGE" => "Đóng gói bị hư hỏng khi vận chuyển",
                    "NEAR_EXPIRY" => "Sản phẩm gần hết hạn / kém chất lượng",
                    "DEFECTIVE" or "PRODUCT_DEFECT" => "Hàng lỗi / hỏng",
                    "EXPIRED" => "Hết hạn / cận hạn",
                    _ => reason
                };
            })
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
        EnsureCanView(order, access);
        if (await RepairInconsistentPaymentsAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        if (await RepairMissingPosTierDiscountAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        if (await TryAdvanceOrderAfterAllCustomBundlesPackedAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<OrderResponse> GetByCodeAsync(string code, OrderAccessContext access, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new OrderValidationException("Mã đơn hàng không được để trống.");
        var order = await _orderRepo.GetByCodeAsync(code.Trim().ToUpperInvariant(), ct)
            ?? throw new OrderNotFoundByCodeException(code);
        EnsureCanView(order, access);
        if (await RepairInconsistentPaymentsAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        if (await RepairMissingPosTierDiscountAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        if (await TryAdvanceOrderAfterAllCustomBundlesPackedAsync(order, ct))
            await _orderRepo.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task<List<OrderActivityResponse>> GetActivitiesAsync(
        Guid orderId, OrderAccessContext access, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);
        EnsureCanView(order, access);

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
        EnsureCanView(sourceOrder, access);
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
        EnsureCanView(sourceOrder, access);

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
            {
                EnsureIdempotentOrderCanBeReturned(existing);
                return MapToResponse(existing);
            }
        }

        var skuProfiles = await GetRequiredSkuProfilesAsync(
            req.Items.Select(i => i.SkuId)
                .Concat((req.CustomBundles ?? []).SelectMany(bundle => bundle.Ingredients).Select(ingredient => ingredient.MaterialSkuId)),
            ct);
        foreach (var item in req.Items)
        {
            var profile = skuProfiles[item.SkuId];
            if (!string.Equals(profile.ProductType, "THANH_PHAM", StringComparison.OrdinalIgnoreCase))
                throw new OrderValidationException("SKU bán phải là THANH_PHAM đang hoạt động.");
        }
        foreach (var ingredient in (req.CustomBundles ?? []).SelectMany(bundle => bundle.Ingredients))
        {
            var profile = skuProfiles[ingredient.MaterialSkuId];
            if (ingredient.Quantity <= 0)
                throw new OrderValidationException("Số lượng component Custom phải lớn hơn 0.");
            if (ingredient.UnitPrice <= 0)
                throw new OrderValidationException(
                    $"Nguyên liệu custom «{ingredient.MaterialSnapshotName?.Trim() ?? ingredient.MaterialSkuCode ?? ingredient.MaterialSkuId.ToString()}» phải có đơn giá lớn hơn 0.");
            if (!profile.CanUseInCustom
                || !string.Equals(profile.ProductType, "NGUYEN_LIEU", StringComparison.OrdinalIgnoreCase)
                   && !string.Equals(profile.ProductType, "BAO_BI", StringComparison.OrdinalIgnoreCase))
                throw new OrderValidationException("SKU không được phép dùng trong Custom.");
        }
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
                profile.CategoryId ?? i.CategoryId,
                profile.InventoryUnit);
        }).ToList();

        OrderInputValidator.ValidateCreateOrder(
            detailInputs, req.DiscountAmount, req.PaidAmount,
            req.OrderChannel, req.ShippingAddress,
            hasCustomBundles: (req.CustomBundles ?? []).Any(b => (b.Ingredients ?? []).Count > 0));

        // Đơn hợp đồng do Kế toán lập ngoài quầy — không thuộc ca bán hàng Kệ Hàng.
        var isContractCheckout = req.ContractId.HasValue || req.OrderChannel == OrderChannel.B2B;
        if (!isContractCheckout)
            await _shiftGuard.EnsureShelfOnDutyAsync(access, ct);

        if (req.OrderKind != OrderKind.Exchange)
        {
            OrderBusinessRules.EnsureSaleLinesHavePositivePrice(
                detailInputs.Select(item => (item.UnitPrice, item.IsGift)));
        }

        var hasGiftItems = detailInputs.Any(i => i.IsGift);
        var customer = req.CustomerId.HasValue && req.CustomerId.Value != Guid.Empty
            ? await _customerCatalogClient.GetCustomerAsync(req.CustomerId.Value, ct)
            : null;

        ContractCatalogProfile? contract = null;
        if (customer?.IsDoanhNghiep == true)
        {
            // B2B chỉ bán qua kênh hợp đồng — POS/COD không phục vụ khách doanh nghiệp.
            if (req.OrderChannel is OrderChannel.POS or OrderChannel.COD)
                throw new OrderValidationException(
                    "Khách doanh nghiệp phải lập đơn theo hợp đồng tại mục «Bán theo hợp đồng», không bán tại quầy POS.");

            contract = await _contractCatalogClient.GetActiveContractAsync(customer.Id, ct);
            OrderBusinessRules.EnsureContractRequiredForCorporate(customer.CustomerGroup, contract?.Id);

            if (req.ContractId.HasValue && req.ContractId.Value != contract!.Id)
                throw new OrderValidationException(
                    "Hợp đồng gửi lên không khớp hợp đồng đang hiệu lực của khách hàng. Vui lòng tải lại trang.");
        }

        if (hasGiftItems)
            EnsureVipCustomer(customer, req.CustomerId);
        var isAuthorizedVipGiftOrder =
            hasGiftItems
            && detailInputs.All(item => item.IsGift)
            && !(req.CustomBundles ?? []).Any(bundle => (bundle.Ingredients ?? []).Count > 0);

        var totalAmount = detailInputs.Sum(i => i.UnitPrice * i.Quantity);
        var bundleTotal = (req.CustomBundles ?? []).Sum(b => b.Ingredients.Sum(i => i.UnitPrice * i.Quantity));
        totalAmount += bundleTotal;

        // Exchange: DiscountAmount includes return credit (+ tier/manual already validated in ReturnAsync).
        // Do not treat that credit as a VIP/manual POS discount.
        if (req.DiscountAmount > 0 && req.OrderKind != OrderKind.Exchange)
        {
            OrderBusinessRules.EnsureManualDiscountAllowed(
                req.DiscountAmount,
                customer?.CustomerGroup,
                customer?.TierId,
                contract?.DiscountPercent,
                totalAmount);
        }

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
            : CalculateMembershipTierDiscount(
                customer,
                Math.Max(0, totalAmount - manualDiscount - promotionDiscount.DiscountAmount));
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
        // Đơn đặt cọc chỉ thu trước một phần nên không áp quy tắc "khách lẻ phải trả đủ";
        // mức tối thiểu 50% được kiểm ở nhánh BackorderAccepted bên dưới.
        var isDepositCheckout = req.AcceptBackorder && req.DepositAmount is > 0;
        if (!isDepositCheckout)
        {
            OrderBusinessRules.EnsureGuestFullyPaid(
                req.CustomerId,
                allocatedPaymentTotal,
                finalAmount);
        }

        if (contract is not null)
        {
            // B2: CurrentDebt bên CustomerService chỉ tăng khi đơn Completed ⇒ phải cộng thêm
            // nợ của các đơn hợp đồng đang chờ, nếu không lập nhiều đơn liên tiếp sẽ lọt hạn mức.
            var pendingContractDebt = await _orderRepo.GetPendingContractDebtAsync(
                customer!.Id, excludeOrderId: null, ct);

            OrderBusinessRules.EnsureCreditLimitNotExceeded(
                customer.CurrentDebt + pendingContractDebt,
                Math.Max(0, finalAmount - allocatedPaymentTotal),
                contract.CreditLimit);
        }

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
            EmployeeSnapshotName = string.IsNullOrWhiteSpace(actorName) ? null : actorName.Trim(),
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
            ContractId = contract?.Id,
            ContractCodeSnapshot = contract?.ContractCode,
            ContractDiscountPercentSnapshot = contract?.DiscountPercent,
            ContractPaymentTermDaysSnapshot = contract?.PaymentTermDays,
            DueDate = contract?.PaymentTermDays is int termDays
                ? DateTime.UtcNow.Date.AddDays(termDays)
                : null,
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
            UnitSnapshot = i.UnitSnapshot,
            Quantity = i.Quantity,
            CostPrice = i.CostPrice,
            UnitPrice = i.UnitPrice,
            SubTotal = i.UnitPrice * i.Quantity,
            IsGift = i.IsGift,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        }).ToList();

        var now = DateTime.UtcNow;

        // Validate custom bundle ingredients trước khi tạo đơn
        if (req.CustomBundles != null && req.CustomBundles.Count > 0)
        {
            var bundleSkuIds = req.CustomBundles
                .Where(b => b.Ingredients != null && b.Ingredients.Count > 0)
                .SelectMany(b => b.Ingredients!)
                .Select(i => i.MaterialSkuId)
                .Where(id => id != Guid.Empty)
                .Distinct()
                .ToList();

            if (bundleSkuIds.Count > 0)
            {
                var profiles = await GetRequiredSkuProfilesAsync(bundleSkuIds, ct);
                foreach (var bundle in req.CustomBundles.Where(b => b.Ingredients != null && b.Ingredients.Count > 0))
                {
                    foreach (var ing in bundle.Ingredients!)
                    {
                        if (ing.MaterialSkuId == Guid.Empty)
                            throw new OrderValidationException("Custom bundle chứa SKU không hợp lệ.");

                        if (!profiles.TryGetValue(ing.MaterialSkuId, out var profile))
                            throw new OrderValidationException($"SKU {ing.MaterialSkuId} không tồn tại.");

                        if (!profile.CanUseInCustom)
                            throw new OrderValidationException(
                                $"SKU {ing.MaterialSkuCode ?? ing.MaterialSkuId.ToString()} không được phép dùng trong Custom Bundle.");

                        var pType = (profile.ProductType ?? "").ToUpperInvariant();
                        if (pType != "NGUYEN_LIEU" && pType != "BAO_BI")
                            throw new OrderValidationException(
                                $"SKU {ing.MaterialSkuCode ?? ing.MaterialSkuId.ToString()} không phải là nguyên liệu hoặc bao bì.");

                        if (ing.Quantity <= 0)
                            throw new OrderValidationException(
                                $"SKU {ing.MaterialSkuCode ?? ing.MaterialSkuId.ToString()} có số lượng không hợp lệ.");
                    }
                }
            }
        }

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
                PaymentPurpose = req.DepositAmount.HasValue && req.DepositAmount.Value > 0
                    ? PaymentPurpose.Deposit
                    : PaymentPurpose.Full,
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

        var (backorderMinLeadDays, backorderMaxLeadDays) = ResolveBackorderLeadTime(order);
        InventoryStockHandlingResponse? stockPreview = null;
        InventoryStockHandlingResponse? customMaterialsPreview = null;
        var isPosOrCodChannel = order.OrderChannel is OrderChannel.POS or OrderChannel.COD;
        if (isPosOrCodChannel
            && (order.OrderDetails?.Count ?? 0) > 0)
        {
            order.FulfillmentPreference = req.FulfillmentPreference;
            stockPreview = await PreparePosStockHandlingAsync(
                order,
                req.AcceptBackorder,
                previewOnly: true,
                backorderMinLeadDays,
                backorderMaxLeadDays,
                ct);
            if (stockPreview.BackorderRequired)
                throw new BackorderConfirmationRequiredException(stockPreview);

            if (string.Equals(stockPreview.StockHandlingMode, "BackorderAccepted", StringComparison.OrdinalIgnoreCase))
            {
                ApplyBackorderAcceptedToOrder(
                    order,
                    req,
                    backorderMinLeadDays,
                    backorderMaxLeadDays,
                    stockPreview,
                    isPosCompletedOnCreate);
            }
            else
            {
                order.FulfillmentPreference = null;
                // Hàng đã đủ ngay khi thanh toán ⇒ không còn là đơn cọc, phải thu đủ.
                if (isDepositCheckout)
                {
                    OrderBusinessRules.EnsureGuestFullyPaid(
                        req.CustomerId,
                        allocatedPaymentTotal,
                        finalAmount);
                }
            }
        }

        if (isPosOrCodChannel && HasCustomIngredients(order))
        {
            customMaterialsPreview = await PrepareCustomMaterialsHandlingAsync(
                order,
                req.AcceptBackorder,
                previewOnly: true,
                backorderMinLeadDays,
                backorderMaxLeadDays,
                ct);
            if (customMaterialsPreview.BackorderRequired)
                throw new BackorderConfirmationRequiredException(customMaterialsPreview);

            if (string.Equals(
                    customMaterialsPreview.StockHandlingMode,
                    "BackorderAccepted",
                    StringComparison.OrdinalIgnoreCase))
            {
                ApplyBackorderAcceptedToOrder(
                    order,
                    req,
                    backorderMinLeadDays,
                    backorderMaxLeadDays,
                    customMaterialsPreview,
                    isPosCompletedOnCreate || order.OrderChannel == OrderChannel.COD);
            }
        }

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
                {
                    // A simultaneous request can lose the unique-claim race while
                    // the winning request is still completing InventoryService.
                    // Preserve the established idempotent response for that race;
                    // the initial lookup above protects later manual retries after
                    // a failed inventory call has left PendingDeduction persisted.
                    return MapToResponse(existing);
                }

                throw;
            }
        }

        InventoryStockHandlingResponse? stockHandling = null;
        InventoryStockHandlingResponse? customMaterialsHandling = null;
        if (ShouldHandlePosStockSynchronously(order))
        {
            stockHandling = await PreparePosStockHandlingAsync(
                order,
                order.BackorderAcceptedAt.HasValue,
                previewOnly: false,
                order.BackorderMinLeadDaysSnapshot ?? backorderMinLeadDays,
                order.BackorderMaxLeadDaysSnapshot ?? backorderMaxLeadDays,
                ct);
            if (stockHandling.BackorderRequired)
                throw new BackorderConfirmationRequiredException(stockHandling);
            // POS-06: mỗi mode ứng với một kịch bản chờ khác nhau ở phía Thủ kho.
            order.OrderStatus = ResolvePosStockHandlingStatus(stockHandling, order.OrderStatus);
            ApplyFulfillmentSnapshot(
                order,
                stockHandling,
                order.FulfillmentPreference ?? FulfillmentPreference.PartialDelivery);
            order.InventorySyncStatus = stockHandling.HasPendingStockReconciliation
                ? InventorySyncStatus.PendingReconciliation
                : InventorySyncStatus.Synced;
        }
        else if (ShouldHandleCodStockSynchronously(order))
        {
            stockHandling = await PreparePosStockHandlingAsync(
                order,
                order.BackorderAcceptedAt.HasValue,
                previewOnly: false,
                order.BackorderMinLeadDaysSnapshot ?? backorderMinLeadDays,
                order.BackorderMaxLeadDaysSnapshot ?? backorderMaxLeadDays,
                ct);
            if (stockHandling.BackorderRequired)
                throw new BackorderConfirmationRequiredException(stockHandling);
            order.OrderStatus = ResolveCodStockHandlingStatus(stockHandling, order.OrderStatus);
            ApplyFulfillmentSnapshot(
                order,
                stockHandling,
                order.FulfillmentPreference ?? FulfillmentPreference.PartialDelivery);
            order.InventorySyncStatus = stockHandling.HasPendingStockReconciliation
                ? InventorySyncStatus.PendingReconciliation
                : InventorySyncStatus.Synced;
        }
        else
        {
            MarkCustomOnlyInventorySyncedIfApplicable(order);
        }

        if ((order.OrderChannel is OrderChannel.POS or OrderChannel.COD)
            && HasCustomIngredients(order))
        {
            customMaterialsHandling = await PrepareCustomMaterialsHandlingAsync(
                order,
                order.BackorderAcceptedAt.HasValue,
                previewOnly: false,
                order.BackorderMinLeadDaysSnapshot ?? backorderMinLeadDays,
                order.BackorderMaxLeadDaysSnapshot ?? backorderMaxLeadDays,
                ct);
            if (customMaterialsHandling.BackorderRequired)
                throw new BackorderConfirmationRequiredException(customMaterialsHandling);

            if (string.Equals(
                    customMaterialsHandling.StockHandlingMode,
                    "BackorderAccepted",
                    StringComparison.OrdinalIgnoreCase))
            {
                order.OrderStatus = PreferHeavierOrderStatus(
                    order.OrderStatus,
                    OrderStatus.WaitingMaterials);
            }

            MarkCustomOnlyInventorySyncedIfApplicable(order);
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

        if (order.OrderStatus == OrderStatus.WaitingTransfer)
        {
            // Notify Warehouse: order needs warehouse transfer
            _ = _notificationClient.SendBroadcastAsync(
                "Warehouse",
                NotificationTypes.OrderWaitingTransfer,
                $"Đơn hàng {order.OrderCode} cần điều chuyển hàng từ Kho sang Kệ",
                $"/inventory/stock-requests");
        }

        if (order.OrderStatus == OrderStatus.WaitingProduction)
        {
            _ = _notificationClient.SendBroadcastAsync(
                "Warehouse",
                NotificationTypes.OrderWaitingProduction,
                $"Đơn hàng {order.OrderCode} cần sản xuất và điều chuyển hàng",
                $"/inventory/stock-requests");
        }

        if (order.OrderStatus == OrderStatus.WaitingMaterials)
        {
            _ = _notificationClient.SendBroadcastAsync(
                "Warehouse",
                NotificationTypes.OrderWaitingMaterials,
                $"Đơn hàng {order.OrderCode} đang chờ nhập nguyên liệu (backorder)",
                $"/inventory/stock-requests");
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

        if (customMaterialsHandling != null)
        {
            await RecordActivityAsync(
                order.Id,
                OrderActivityType.InventorySynced,
                customMaterialsHandling.Message,
                actorId,
                actorName,
                ct);
        }

        // G4: enqueue integration events vào Outbox TRƯỚC SaveChanges để OutboxMessage
        // commit atomically cùng Order/OrderDetail/Payment/Activity trong một transaction.
        if (!ShouldSuppressLegacyOrderPlacedEvent(order, stockHandling))
        {
            await _eventPublisher.PublishOrderPlacedAsync(
                order.Id, order.OrderCode, order.OrderStatus.ToString(), order.OrderChannel.ToString(), finalAmount,
                (order.OrderDetails ?? []).Select(d => (d.SkuId, d.SkuSnapshotName, d.SkuSnapshotCode, d.Quantity)),
                order.CustomerSnapshotName,
                ct);
        }

        if (order.OrderStatus == OrderStatus.Completed && order.CustomerId.HasValue)
            await EnqueueOrderCompletedAsync(order, debtAmount, ct);

        await _orderRepo.SaveChangesAsync(ct);

        // Ca quỹ POS: chỉ ghi nhận phần tiền mặt đã thu thành công, sau khi đơn đã commit.
        if (order.OrderChannel == OrderChannel.POS)
        {
            var cashCollected = payments
                .Where(p => p.PaymentMethod == PaymentMethod.Cash && p.PaymentStatus == PaymentStatus.Success)
                .Sum(p => p.Amount);
            if (cashCollected > 0)
                await _posCashSessionLogic.RecordCashSaleAsync(cashCollected, ct);
        }

        if (order.OrderStatus is OrderStatus.Completed or OrderStatus.WaitingTransfer or OrderStatus.WaitingProduction)
            TrySendInvoiceEmail(order);

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

            // Mỗi đơn chỉ dùng đúng một phương thức thanh toán; mảng Payments được giữ lại
            // vì COD/VietQR vẫn gửi một phần tử kèm DebtSettlementJson.
            if (request.Payments.Count > 1)
            {
                throw new OrderValidationException(
                    "Mỗi đơn hàng chỉ được sử dụng một phương thức thanh toán.");
            }

            var hasCod = request.Payments.Any(item => item.PaymentMethod == PaymentMethod.COD);

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

        // Form B2B cũ gửi COD cho «ghi nợ» — không tạo khoản thu hộ COD.
        var requestedMethod = request.Payments is { Count: > 0 }
            ? request.Payments[0].PaymentMethod
            : request.PaymentMethod;
        if (request.OrderChannel == OrderChannel.B2B
            && requestedMethod is PaymentMethod.COD or PaymentMethod.Debt
            && request.PaidAmount <= 0
            && (request.Payments is null || request.Payments.Count == 0 || request.Payments.All(p => p.Amount <= 0)))
        {
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

    private static void EnsureVipCustomer(CustomerCatalogProfile? customer, Guid? customerId)
    {
        if (!customerId.HasValue || customerId == Guid.Empty)
            throw new OrderValidationException(
                "Quà tặng và chiết khấu thủ công chỉ áp dụng cho khách đối ngoại (VIP). Vui lòng chọn khách VIP.");

        if (customer is null || !customer.IsVipCustomer)
            throw new OrderValidationException(
                "Quà tặng và chiết khấu thủ công chỉ dành cho khách đối ngoại (VIP).");
    }

    private async Task EnsureVipCustomerAsync(Guid? customerId, CancellationToken ct)
    {
        if (!customerId.HasValue || customerId == Guid.Empty)
            throw new OrderValidationException(
                "Quà tặng và chiết khấu thủ công chỉ áp dụng cho khách đối ngoại (VIP). Vui lòng chọn khách VIP.");

        var customer = await _customerCatalogClient.GetCustomerAsync(customerId.Value, ct);
        EnsureVipCustomer(customer, customerId);
    }

    private async Task EnsureManualDiscountAllowedAsync(
        Order order, decimal manualDiscount, CancellationToken ct)
    {
        if (!order.CustomerId.HasValue || order.CustomerId.Value == Guid.Empty)
        {
            OrderBusinessRules.EnsureManualDiscountAllowed(manualDiscount, null);
            return;
        }

        var customer = await _customerCatalogClient.GetCustomerAsync(order.CustomerId.Value, ct);
        OrderBusinessRules.EnsureManualDiscountAllowed(
            manualDiscount,
            customer?.CustomerGroup,
            customer?.TierId,
            order.ContractDiscountPercentSnapshot,
            order.TotalAmount);
    }

    private async Task ApplyOrderDetailUpdatesAsync(
        Order order, List<UpdateOrderDetailRequest> items, CancellationToken ct)
    {
        if (items.Any(i => i.IsGift))
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
                detail.UnitSnapshot = profile.InventoryUnit;
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
                UnitSnapshot = profile.InventoryUnit,
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
        EnsureCanModify(order, access);
        await _shiftGuard.EnsureShelfOnDutyAsync(access, ct);

        if (order.OrderStatus is OrderStatus.Completed or OrderStatus.Cancelled
            or OrderStatus.WaitingMaterials or OrderStatus.CancellationRequested)
            throw new OrderCannotBeModifiedException(id, order.OrderStatus.ToString());

        // POS-04 (H4): sửa sản phẩm của đơn COD đang giữ chỗ tồn Kệ (trước Shipping) phải
        // thay giữ chỗ đồng bộ ở Inventory TRƯỚC khi lưu đơn. Chụp lại danh sách items cũ
        // để bồi hoàn nếu lưu đơn thất bại sau khi Inventory đã thay giữ chỗ.
        var mustReplaceCodReservation = order.OrderChannel == OrderChannel.COD
            && req.Items is { Count: > 0 }
            && order.OrderStatus != OrderStatus.Draft
            && order.OrderStatus != OrderStatus.Shipping;
        var originalReservationItems = mustReplaceCodReservation
            ? (order.OrderDetails ?? [])
                .Select(d => new InventoryReservationReplaceItemRequest(
                    d.SkuId, d.SkuSnapshotName, d.SkuSnapshotCode, d.Quantity))
                .ToList()
            : null;
        var originalFinalAmount = order.FinalAmount;

        if (req.Items is { Count: > 0 })
            await ApplyOrderDetailUpdatesAsync(order, req.Items, ct);

        var manualDiscount = Math.Max(0, req.DiscountAmount);
        if (manualDiscount > 0)
            await EnsureManualDiscountAllowedAsync(order, manualDiscount, ct);

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
        OrderInputValidator.ValidateShippingAddressForChannel(order.OrderChannel, order.ShippingAddress);
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

        // B5: tạo đơn nhỏ (qua hạn mức) rồi sửa lên số lớn phải bị chặn như lúc tạo.
        // Dùng snapshot ContractId của đơn — không cho đổi hợp đồng khi sửa.
        if (order.ContractId.HasValue && order.CustomerId.HasValue && remainingAmount > 0)
        {
            var contract = await _contractCatalogClient.GetActiveContractAsync(order.CustomerId.Value, ct);
            if (contract is not null)
            {
                var customerProfile = await _customerCatalogClient.GetCustomerAsync(order.CustomerId.Value, ct);
                var pendingContractDebt = await _orderRepo.GetPendingContractDebtAsync(
                    order.CustomerId.Value, excludeOrderId: order.Id, ct);

                OrderBusinessRules.EnsureCreditLimitNotExceeded(
                    (customerProfile?.CurrentDebt ?? 0m) + pendingContractDebt,
                    remainingAmount,
                    contract.CreditLimit);
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

        // POS-04 (H4): gọi Inventory thay giữ chỗ đồng bộ, all-or-nothing, idempotent theo
        // OperationId — Inventory từ chối (thiếu tồn khả bán) thì đơn không được lưu,
        // items cũ + giữ chỗ cũ giữ nguyên. Nếu lưu đơn thất bại SAU khi Inventory đã thay
        // giữ chỗ, bồi hoàn bằng cách thay lại theo items cũ (best-effort, không đảm bảo
        // atomicity phân tán tuyệt đối — thất bại bồi hoàn sẽ được ném ra để lộ rõ sự cố).
        var replacedReservation = false;
        if (mustReplaceCodReservation)
        {
            await ReplaceCodReservationAsync(order, ct);
            replacedReservation = true;
        }

        try
        {
            await _orderRepo.SaveChangesAsync(ct);
        }
        catch (Exception saveEx) when (replacedReservation && originalReservationItems is not null)
        {
            // Bồi hoàn: thay lại giữ chỗ theo items cũ với OperationId mới. Nếu chính bước
            // bồi hoàn cũng thất bại thì gộp cả hai lỗi để không che giấu sự cố lệch giữ chỗ.
            try
            {
                await _inventoryCatalogClient.ReplaceCodReservationAsync(
                    new InventoryReservationReplaceRequest(
                        order.Id,
                        Guid.NewGuid(),
                        originalFinalAmount,
                        originalReservationItems),
                    ct);
            }
            catch (Exception compensationEx)
            {
                throw new AggregateException(
                    "Lưu đơn COD thất bại sau khi đã thay giữ chỗ tồn, và bồi hoàn giữ chỗ cũng thất bại. Cần kiểm tra thủ công giữ chỗ tồn của đơn.",
                    saveEx,
                    compensationEx);
            }
            throw;
        }

        return MapToResponse(order);
    }

    public async Task CancelAsync(
        Guid id, OrderAccessContext access, string? reason = null, Guid? actorId = null, string? actorName = null, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        EnsureCanModify(order, access);
        if (!OrderAccessContext.IsContractOrder(order))
            await _shiftGuard.EnsureShelfOnDutyAsync(access, ct);

        if (order.OrderStatus is OrderStatus.Completed or OrderStatus.Cancelled
            or OrderStatus.CancellationRequested)
            throw new OrderCannotBeCancelledException(id, order.OrderStatus.ToString());

        var payments = order.Payments ?? await GetPaymentsInternal(order.Id, ct);
        // Đơn đặt cọc: khách mất cọc khi hủy, không đi qua luồng duyệt hoàn tiền.
        var isDepositOrder = order.DepositAmount is > 0;
        if (IsBackorderRefundGuardedStatus(order.OrderStatus)
            && !isDepositOrder
            && payments.Any(payment => payment.PaymentStatus == PaymentStatus.Success))
        {
            throw new OrderValidationException(
                "Đơn chờ hàng đã thu tiền. Hãy gửi yêu cầu hủy để Manager duyệt và hoàn tiền có bằng chứng.");
        }

        // POS-04 (quyết định #10): giữ lại trạng thái trước khi hủy để Inventory biết
        // đơn đã Shipping hay chưa — hủy sau Shipping không được cộng lại tồn Kệ.
        var statusBeforeCancel = order.OrderStatus;

        order.OrderStatus = OrderStatus.Cancelled;
        order.InventorySyncStatus = InventorySyncStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;

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
        if (isDepositOrder)
            description += $" Giữ lại tiền cọc {FormatVnd(order.DepositAmount!.Value)}, không hoàn lại.";

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Cancelled,
            description,
            actorId,
            actorName,
            ct);

        // G4: enqueue cancellation event trước SaveChanges (atomic với đổi trạng thái đơn).
        await _eventPublisher.PublishOrderCancelledAsync(
            order.Id, order.OrderCode, statusBeforeCancel.ToString(),
            (order.OrderDetails ?? []).Select(d => (d.SkuId, d.Quantity)),
            ct);

        await _orderRepo.SaveChangesAsync(ct);

        // Đồng bộ hủy lệnh chờ trừ kho ngay (không chờ Outbox/Rabbit) — tránh Thủ kho Confirm void tồn.
        await TryCancelLinkedStockQueuesAsync(
            order.Id,
            string.IsNullOrWhiteSpace(reason) ? "Đơn hàng đã hủy" : reason.Trim(),
            statusBeforeCancel.ToString(),
            ct);
    }

    public async Task<OrderResponse> RequestBackorderCancellationAsync(
        Guid id,
        OrderAccessContext access,
        string? reason,
        Guid? actorId = null,
        string? actorName = null,
        CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        EnsureCanModify(order, access);
        await _shiftGuard.EnsureShelfOnDutyAsync(access, ct);

        if (order.OrderStatus == OrderStatus.CancellationRequested)
            return MapToResponse(order);
        if (!IsBackorderRefundGuardedStatus(order.OrderStatus))
            throw new OrderValidationException("Chỉ đơn đang chờ hàng mới được gửi yêu cầu hủy backorder.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new OrderValidationException("Lý do yêu cầu hủy là bắt buộc.");
        if (reason.Trim().Length > 500)
            throw new OrderValidationException("Lý do yêu cầu hủy tối đa 500 ký tự.");

        var payments = order.Payments ?? await GetPaymentsInternal(order.Id, ct);
        var collectedAmount = payments
            .Where(payment => payment.PaymentStatus == PaymentStatus.Success)
            .Sum(payment => payment.Amount);
        // Đơn đặt cọc: toàn bộ tiền đã thu bị giữ lại — không còn gì để hoàn, hủy thẳng.
        if (collectedAmount <= 0 || order.DepositAmount is > 0)
        {
            await CancelAsync(id, access, reason, actorId, actorName, ct);
            return MapToResponse(order);
        }

        var now = DateTime.UtcNow;
        order.OrderStatus = OrderStatus.CancellationRequested;
        order.RefundStatus = BackorderRefundStatus.PendingApproval;
        order.RefundAmount = collectedAmount;
        order.CancellationReason = reason.Trim();
        order.CancellationRequestedAt = now;
        order.CancellationRequestedBy = actorId;
        order.CancellationRequestedByName = NormalizeActorName(actorName);
        order.UpdatedAt = now;

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Updated,
            $"Đã gửi yêu cầu hủy đơn chờ nguyên liệu và hoàn {FormatVnd(collectedAmount)}. Lý do: {reason.Trim()}",
            actorId,
            actorName,
            ct);
        await _orderRepo.SaveChangesAsync(ct);

        // Notify Manager: backorder cancellation needs approval
        _ = _notificationClient.SendBroadcastAsync(
            "Manager",
            NotificationTypes.OrderCancellationPendingApproval,
            $"Đơn {order.OrderCode} yêu cầu hủy và hoàn tiền {FormatVnd(collectedAmount)}",
            $"/orders/{order.Id}");

        // Đóng băng lệnh chờ trừ kho — Thủ kho không Confirm trong lúc chờ duyệt hủy/hoàn tiền.
        await TryFreezeLinkedStockQueuesAsync(order.Id, reason.Trim(), ct);

        return MapToResponse(order);
    }

    public async Task<OrderResponse> ReviewBackorderCancellationAsync(
        Guid id,
        ReviewBackorderCancellationRequest request,
        OrderAccessContext access,
        Guid? actorId = null,
        string? actorName = null,
        CancellationToken ct = default)
    {
        if (!access.CanViewAllOrders)
            throw new OrderForbiddenException();

        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        if (request.Approved && order.RefundStatus == BackorderRefundStatus.Approved)
            return MapToResponse(order);
        if (!request.Approved && order.RefundStatus == BackorderRefundStatus.Rejected)
            return MapToResponse(order);
        if (order.OrderStatus != OrderStatus.CancellationRequested
            || order.RefundStatus != BackorderRefundStatus.PendingApproval)
        {
            throw new OrderValidationException("Yêu cầu hủy không còn ở trạng thái chờ duyệt.");
        }

        var now = DateTime.UtcNow;
        if (request.Approved)
        {
            order.RefundStatus = BackorderRefundStatus.Approved;
            order.RefundApprovedAt = now;
            order.RefundApprovedBy = actorId;
            order.RefundApprovedByName = NormalizeActorName(actorName);
        }
        else
        {
            order.OrderStatus = OrderStatus.WaitingMaterials;
            order.RefundStatus = BackorderRefundStatus.Rejected;
        }
        order.UpdatedAt = now;

        var reviewNote = string.IsNullOrWhiteSpace(request.Note)
            ? string.Empty
            : $" Ghi chú: {request.Note.Trim()[..Math.Min(request.Note.Trim().Length, 300)]}";
        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Updated,
            request.Approved
                ? $"Manager đã duyệt yêu cầu hủy và hoàn tiền.{reviewNote}"
                : $"Manager đã từ chối yêu cầu hủy; đơn quay lại chờ nguyên liệu.{reviewNote}",
            actorId,
            actorName,
            ct);
        await _orderRepo.SaveChangesAsync(ct);

        if (request.Approved)
        {
            if (order.CancellationRequestedBy.HasValue)
                _ = _notificationClient.SendDirectAsync(
                    order.CancellationRequestedBy.Value,
                    NotificationTypes.OrderCancellationApproved,
                    $"Yêu cầu hủy đơn {order.OrderCode} đã được duyệt",
                    $"/orders/{order.Id}");
        }
        else
        {
            if (order.CancellationRequestedBy.HasValue)
                _ = _notificationClient.SendDirectAsync(
                    order.CancellationRequestedBy.Value,
                    NotificationTypes.OrderCancellationRejected,
                    $"Yêu cầu hủy đơn {order.OrderCode} bị từ chối",
                    $"/orders/{order.Id}");
        }

        if (!request.Approved)
            await TryUnfreezeLinkedStockQueuesAsync(order.Id, ct);

        return MapToResponse(order);
    }

    public async Task<OrderResponse> CompleteBackorderRefundAsync(
        Guid id,
        CompleteBackorderRefundRequest request,
        OrderAccessContext access,
        Guid? actorId = null,
        string? actorName = null,
        CancellationToken ct = default)
    {
        if (!access.CanViewAllOrders)
            throw new OrderForbiddenException();
        if (string.IsNullOrWhiteSpace(request.RefundMethod))
            throw new OrderValidationException("Phương thức hoàn tiền là bắt buộc.");
        var refundMethod = request.RefundMethod.Trim();
        if (refundMethod.Length > 30)
            throw new OrderValidationException("Phương thức hoàn tiền tối đa 30 ký tự.");

        var isCashRefund = refundMethod.Equals("Cash", StringComparison.OrdinalIgnoreCase)
            || refundMethod.Equals("Tiền mặt", StringComparison.OrdinalIgnoreCase)
            || refundMethod.Equals("Tien mat", StringComparison.OrdinalIgnoreCase);
        var refundEvidence = request.RefundEvidence?.Trim() ?? string.Empty;
        if (!isCashRefund && string.IsNullOrWhiteSpace(refundEvidence))
            throw new OrderValidationException("Bằng chứng hoàn tiền là bắt buộc với chuyển khoản.");
        if (refundEvidence.Length > 1000)
            throw new OrderValidationException("Bằng chứng hoàn tiền tối đa 1000 ký tự.");

        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        if (order.OrderStatus == OrderStatus.Cancelled
            && order.RefundStatus == BackorderRefundStatus.Completed)
            return MapToResponse(order);
        if (order.OrderStatus != OrderStatus.CancellationRequested
            || order.RefundStatus != BackorderRefundStatus.Approved)
        {
            throw new OrderValidationException("Yêu cầu hoàn tiền chưa được duyệt hoặc đã được xử lý.");
        }

        var hasDeliveredImmediateItems = order.FulfillmentPreference == FulfillmentPreference.PartialDelivery
            && (order.OrderDetails ?? []).Any(detail => detail.ImmediateFulfilledQuantity > 0);
        if (hasDeliveredImmediateItems && !request.ImmediateItemsReturned)
        {
            throw new OrderValidationException(
                "Đơn đã giao một phần. Phải thu hồi và xác nhận đã nhận lại phần hàng giao ngay trước khi hoàn toàn bộ tiền.");
        }

        var payments = order.Payments ?? await GetPaymentsInternal(order.Id, ct);
        var cashRefund = 0m;
        foreach (var payment in payments.Where(payment => payment.PaymentStatus == PaymentStatus.Success))
        {
            if (payment.PaymentMethod == PaymentMethod.Cash)
                cashRefund += payment.Amount;
            payment.PaymentStatus = PaymentStatus.Refunded;
            payment.UpdatedAt = DateTime.UtcNow;
        }

        var now = DateTime.UtcNow;
        order.OrderStatus = OrderStatus.Cancelled;
        order.InventorySyncStatus = InventorySyncStatus.Cancelled;
        order.RefundStatus = BackorderRefundStatus.Completed;
        order.RefundMethod = refundMethod;
        order.RefundEvidence = string.IsNullOrWhiteSpace(refundEvidence) ? null : refundEvidence;
        order.RefundedAt = now;
        order.RefundedBy = actorId;
        order.RefundedByName = NormalizeActorName(actorName);
        order.UpdatedAt = now;

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Cancelled,
            hasDeliveredImmediateItems
                ? $"Đã xác nhận thu hồi phần hàng giao ngay, hoàn {FormatVnd(order.RefundAmount ?? 0)} qua {order.RefundMethod}; đã lưu bằng chứng và hủy đơn."
                : $"Đã hoàn {FormatVnd(order.RefundAmount ?? 0)} qua {order.RefundMethod}; đã lưu bằng chứng và hủy đơn.",
            actorId,
            actorName,
            ct);
        await _eventPublisher.PublishOrderCancelledAsync(
            order.Id,
            order.OrderCode,
            OrderStatus.WaitingMaterials.ToString(),
            (order.OrderDetails ?? []).Select(detail => (detail.SkuId, detail.Quantity)),
            ct);
        await _orderRepo.SaveChangesAsync(ct);

        await TryCancelLinkedStockQueuesAsync(
            order.Id,
            "Hoàn tiền backorder và hủy đơn",
            OrderStatus.WaitingMaterials.ToString(),
            ct);

        if (cashRefund > 0)
            await _posCashSessionLogic.RecordCashRefundAsync(cashRefund, ct);

        return MapToResponse(order);
    }

    public async Task<OrderResponse> CancelPendingTransferAsync(
        Guid id,
        OrderAccessContext access,
        Guid? actorId = null,
        string? actorName = null,
        CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        if (!access.CanModifyOrder(order) && order.EmployeeId != access.UserId)
            throw new OrderForbiddenException();

        if (order.OrderStatus == OrderStatus.Cancelled)
        {
            // Re-publishing is safe because InventoryService de-duplicates cancellation by OrderId.
            // It also lets an idempotent retry repair a previously failed broker publish.
            await _eventPublisher.PublishOrderCancelledAsync(
                order.Id,
                order.OrderCode,
                OrderStatus.PendingPayment.ToString(),
                (order.OrderDetails ?? []).Select(detail => (detail.SkuId, detail.Quantity)),
                ct);
            // G4: persist outbox row (enqueue chỉ track entity).
            await _orderRepo.SaveChangesAsync(ct);
            return MapToResponse(order);
        }
        if (order.OrderStatus == OrderStatus.Completed)
            throw new OrderValidationException("Giao dịch đã được xác nhận thành công nên không thể hủy thanh toán.");
        if (order.OrderStatus != OrderStatus.PendingPayment)
            throw new OrderValidationException("Chỉ được hủy đơn đang chờ thanh toán chuyển khoản.");

        var payments = order.Payments ?? await GetPaymentsInternal(order.Id, ct);
        var transferPayment = payments.FirstOrDefault(payment =>
            payment.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer);
        if (transferPayment is null)
            throw new OrderValidationException("Đơn không có khoản thanh toán chuyển khoản.");
        if (transferPayment.PaymentStatus == PaymentStatus.Success)
            throw new OrderValidationException("Giao dịch đã được xác nhận thành công nên không thể hủy thanh toán.");

        var claimed = await _orderRepo.TryTransitionStatusAsync(
            order.Id,
            OrderStatus.PendingPayment,
            OrderStatus.Cancelled,
            ct);
        if (!claimed)
        {
            throw new OrderValidationException(
                "Trạng thái thanh toán vừa thay đổi. Giao dịch có thể đã được xác nhận; vui lòng tải lại.");
        }

        order.OrderStatus = OrderStatus.Cancelled;
        order.InventorySyncStatus = InventorySyncStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;
        foreach (var payment in payments)
        {
            payment.PaymentStatus = PaymentStatus.Failed;
            payment.PaidAt = null;
            payment.UpdatedAt = DateTime.UtcNow;
        }

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Cancelled,
            "Hủy thanh toán chuyển khoản và hoàn tác checkout POS đang chờ.",
            actorId,
            actorName,
            ct);

        // G4: enqueue trước SaveChanges để atomic với hoàn tác checkout.
        await _eventPublisher.PublishOrderCancelledAsync(
            order.Id,
            order.OrderCode,
            OrderStatus.PendingPayment.ToString(),
            (order.OrderDetails ?? []).Select(detail => (detail.SkuId, detail.Quantity)),
            ct);

        await _orderRepo.SaveChangesAsync(ct);

        await TryCancelLinkedStockQueuesAsync(
            order.Id,
            "Hủy thanh toán chuyển khoản POS",
            OrderStatus.PendingPayment.ToString(),
            ct);

        return MapToResponse(order);
    }

    public async Task MarkShippingAsync(
        Guid id, OrderAccessContext access, Guid? actorId = null, string? actorName = null, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        EnsureCanModify(order, access);

        // Validate state machine transition
        OrderStatusTransition.EnsureValidTransition(order.OrderStatus, OrderStatus.Shipping, order.Id);

        if (OrderAccessContext.IsContractOrder(order))
        {
            // Bước 2 của luồng hợp đồng: chỉ Thủ kho / Quản lý xác nhận xuất hàng.
            if (!access.CanShipOrder)
                throw new OrderForbiddenException();
        }
        else if (order.InventorySyncStatus != InventorySyncStatus.Synced)
        {
            // COD/online đã đồng bộ kho: Thủ kho đã xuất/SX xong — chuyển «đang giao» là
            // bàn giao vận chuyển, không còn phụ thuộc ca quầy (Sale vẫn ship được ngoài giờ ca).
            await _shiftGuard.EnsureShelfOnDutyAsync(access, ct);
        }

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

        // POS-04 (H5, quyết định #7): bàn giao giao hàng là trigger duy nhất trừ tồn vật lý
        // Kệ Hàng cho đơn COD đã giữ chỗ. Enqueue Outbox TRƯỚC SaveChanges để event commit
        // atomic cùng chuyển trạng thái; Inventory Inbox dedupe theo EventId + business key
        // nên duplicate Shipping không trừ lần hai.
        await _eventPublisher.PublishOrderShippedAsync(
            order.Id, order.OrderCode, order.OrderChannel.ToString(),
            (order.OrderDetails ?? []).Select(d => (d.SkuId, d.SkuSnapshotName, d.SkuSnapshotCode, d.Quantity)),
            ct);

        await _orderRepo.SaveChangesAsync(ct);
    }

    /// <summary>
    /// POS-06 (KB4): Sale xác nhận khách đã quay lại lấy hàng. Chỉ nhận đơn ở
    /// <see cref="OrderStatus.ReadyToDeliver"/>; ghi log người giao rồi hoàn tất đơn.
    /// </summary>
    public async Task MarkDeliveredAsync(
        Guid id, OrderAccessContext access, Guid? actorId = null, string? actorName = null, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        // Khách tới quầy nhận hàng có thể gặp bất kỳ thu ngân nào đang trực,
        // không nhất thiết là người đã tạo đơn.
        EnsureCanView(order, access);

        if (order.OrderStatus != OrderStatus.ReadyToDeliver)
        {
            if (order.OrderStatus == OrderStatus.Completed)
                return;
            throw new OrderCannotBeModifiedException(id, order.OrderStatus.ToString());
        }

        var claimed = await _orderRepo.TryTransitionStatusAsync(
            order.Id, OrderStatus.ReadyToDeliver, OrderStatus.Completed, ct);
        if (!claimed)
        {
            var current = await _orderRepo.GetByIdAsync(order.Id, ct)
                ?? throw new OrderNotFoundException(order.Id);
            if (current.OrderStatus == OrderStatus.Completed)
                return;
            throw new OrderValidationException("Trạng thái đơn vừa thay đổi; không thể xác nhận giao hàng.");
        }

        // TryTransition đã Reload entity — status = Completed, RowVersion khớp DB.
        var deliveredAt = DateTime.UtcNow;
        order.CompletedAt ??= deliveredAt;
        order.DeliveredAt = deliveredAt;
        order.DeliveredBy = actorId;
        order.DeliveredByName = actorName;
        order.UpdatedAt = deliveredAt;

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Completed,
            $"Đã giao hàng cho khách{(string.IsNullOrWhiteSpace(actorName) ? string.Empty : $" bởi {actorName}")}.",
            actorId,
            actorName,
            ct);

        if (order.CustomerId.HasValue)
        {
            var paidAmount = (order.Payments ?? [])
                .Where(payment => payment.PaymentStatus == PaymentStatus.Success)
                .Sum(payment => payment.Amount);
            await EnqueueOrderCompletedAsync(order, Math.Max(0, order.FinalAmount - paidAmount), ct);
        }

        await _orderRepo.SaveChangesAsync(ct);

        if (order.CustomerId.HasValue)
            TrySendInvoiceEmail(order);
    }

    /// <summary>
    /// POS-06 (cọc): thu nốt phần còn lại khi khách quay lại nhận hàng rồi hoàn tất đơn.
    /// </summary>
    public async Task<OrderResponse> CollectRemainingAndDeliverAsync(
        Guid id,
        CollectRemainingRequest request,
        OrderAccessContext access,
        Guid? actorId = null,
        string? actorName = null,
        CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        EnsureCanView(order, access);

        if (order.DepositAmount is not > 0)
            throw new OrderValidationException("Đơn này không phải đơn đặt cọc.");

        // ReadyToDeliver = luồng chuẩn; Completed + còn thiếu tiền = sửa lỗi concurrency cũ
        // (đã chuyển Completed trước khi ghi được khoản thu nốt).
        if (order.OrderStatus is not (OrderStatus.ReadyToDeliver or OrderStatus.Completed))
            throw new OrderCannotBeModifiedException(id, order.OrderStatus.ToString());

        var payments = order.Payments ?? await GetPaymentsInternal(order.Id, ct);
        var collected = payments
            .Where(payment => payment.PaymentStatus == PaymentStatus.Success)
            .Sum(payment => payment.Amount);
        var remaining = Math.Max(0, order.FinalAmount - collected);

        if (order.OrderStatus == OrderStatus.Completed && remaining <= 0)
            return MapToResponse(order);

        if (remaining > 0 && request.Amount < remaining)
        {
            throw new OrderValidationException(
                $"Số tiền thu chưa đủ. Còn phải thu {FormatVnd(remaining)}.");
        }

        if (remaining > 0)
        {
            var paidAt = DateTime.UtcNow;
            // QR thu phần còn lại đã tạo sẵn một Payment Pending — tái sử dụng để không ghi trùng.
            var remainingPayment = payments.FirstOrDefault(payment =>
                payment.PaymentPurpose == PaymentPurpose.RemainingAtPickup
                && payment.PaymentStatus == PaymentStatus.Pending);

            if (remainingPayment is not null)
            {
                remainingPayment.PaymentMethod = request.PaymentMethod;
                remainingPayment.Amount = remaining;
                remainingPayment.PaymentStatus = PaymentStatus.Success;
                remainingPayment.TransactionRef = string.IsNullOrWhiteSpace(request.TransactionRef)
                    ? remainingPayment.TransactionRef
                    : request.TransactionRef.Trim();
                remainingPayment.PaidAt = paidAt;
                remainingPayment.UpdatedAt = paidAt;
            }
            else
            {
                remainingPayment = new Payment
                {
                    Id = Guid.NewGuid(),
                    OrderId = order.Id,
                    PaymentMethod = request.PaymentMethod,
                    Amount = remaining,
                    PaymentStatus = PaymentStatus.Success,
                    PaymentPurpose = PaymentPurpose.RemainingAtPickup,
                    TransactionRef = string.IsNullOrWhiteSpace(request.TransactionRef)
                        ? null
                        : request.TransactionRef.Trim(),
                    IsCodVerified = false,
                    PaidAt = paidAt,
                    CreatedAt = paidAt,
                    UpdatedAt = paidAt
                };
                await _paymentRepo.AddAsync(remainingPayment, ct);
                order.Payments?.Add(remainingPayment);
            }

            await RecordActivityAsync(
                order.Id,
                OrderActivityType.Updated,
                $"Thu nốt {FormatVnd(remaining)} khi khách nhận hàng ({GetPaymentMethodLabel(request.PaymentMethod)}).",
                actorId,
                actorName,
                ct);

            // Ghi thanh toán trước khi chuyển Completed — tránh mất khoản thu nếu bước giao lỗi.
            await _orderRepo.SaveChangesAsync(ct);
        }

        if (order.OrderStatus == OrderStatus.ReadyToDeliver)
            await MarkDeliveredAsync(id, access, actorId, actorName, ct);

        var refreshed = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        return MapToResponse(refreshed);
    }

    /// <summary>
    /// POS-06 (cọc): Manager hủy đơn đặt cọc quá 7 ngày kể từ ngày hẹn. Tiền cọc bị giữ lại.
    /// </summary>
    public async Task<OrderResponse> CancelOverdueDepositAsync(
        Guid id,
        OrderAccessContext access,
        string? reason,
        Guid? actorId = null,
        string? actorName = null,
        CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        if (!access.CanViewAllOrders)
            throw new OrderForbiddenException();

        if (order.DepositAmount is not > 0)
            throw new OrderValidationException("Chỉ đơn đặt cọc mới dùng được luồng hủy quá hạn.");
        if (!IsBackorderRefundGuardedStatus(order.OrderStatus))
            throw new OrderCannotBeCancelledException(id, order.OrderStatus.ToString());
        if (!order.PickupDate.HasValue)
            throw new OrderValidationException("Đơn chưa có ngày hẹn nhận hàng.");

        var overdueDays = (DateTime.UtcNow.Date - order.PickupDate.Value.Date).Days;
        if (overdueDays < OverdueDepositCancelDays)
        {
            throw new OrderValidationException(
                $"Chỉ được hủy sau {OverdueDepositCancelDays} ngày kể từ ngày hẹn. Hiện quá hạn {Math.Max(0, overdueDays)} ngày.");
        }

        var statusBeforeCancel = order.OrderStatus;
        var now = DateTime.UtcNow;
        order.OrderStatus = OrderStatus.Cancelled;
        order.InventorySyncStatus = InventorySyncStatus.Cancelled;
        order.RefundStatus = BackorderRefundStatus.NotRequired;
        order.RefundAmount = null;
        order.CancellationReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        order.CancellationRequestedAt = now;
        order.CancellationRequestedBy = actorId;
        order.CancellationRequestedByName = NormalizeActorName(actorName);
        order.UpdatedAt = now;

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Cancelled,
            $"Hủy đơn quá hạn nhận hàng {overdueDays} ngày. Giữ lại tiền cọc {FormatVnd(order.DepositAmount!.Value)}, không hoàn lại."
                + (string.IsNullOrWhiteSpace(reason) ? string.Empty : $" Lý do: {reason.Trim()}"),
            actorId,
            actorName,
            ct);

        await _eventPublisher.PublishOrderCancelledAsync(
            order.Id, order.OrderCode, statusBeforeCancel.ToString(),
            (order.OrderDetails ?? []).Select(d => (d.SkuId, d.Quantity)),
            ct);

        await _orderRepo.SaveChangesAsync(ct);

        await TryCancelLinkedStockQueuesAsync(
            order.Id,
            string.IsNullOrWhiteSpace(reason) ? "Hủy đơn đặt cọc quá hạn" : reason.Trim(),
            statusBeforeCancel.ToString(),
            ct);

        return MapToResponse(order);
    }

    public async Task CompleteAsync(
        Guid id, OrderAccessContext access, Guid? actorId = null, string? actorName = null,
        decimal? actualReceivedAmount = null, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        EnsureCanModify(order, access);

        // Validate state machine transition trước
        var targetStatus = order.BackorderAcceptedAt.HasValue ? OrderStatus.WaitingMaterials : OrderStatus.Completed;
        OrderStatusTransition.EnsureValidTransition(order.OrderStatus, targetStatus, order.Id);

        if (OrderAccessContext.IsContractOrder(order))
        {
            // Bước 3 của luồng hợp đồng: chỉ Kế toán / Quản lý xác nhận khách đã ký nhận.
            if (!access.CanConfirmB2BDelivery)
                throw new OrderForbiddenException();

            if (order.OrderStatus != OrderStatus.Shipping)
                throw new OrderValidationException(
                    "Đơn hợp đồng phải được kho xác nhận xuất hàng trước khi hoàn tất.");
        }
        else
        {
            await _shiftGuard.EnsureShelfOnDutyAsync(access, ct);
        }

        if (order.OrderStatus is OrderStatus.Cancelled or OrderStatus.Completed
            or OrderStatus.WaitingMaterials or OrderStatus.CancellationRequested)
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

        // Re-check stock before recording a delayed QR/bank-transfer confirmation. Stock can
        // change after the QR was created; a non-consented backorder must not be committed as a
        // successful payment/completed order and only fail later during the stock mutation.
        if (hasPendingTransfer
            && order.OrderChannel == OrderChannel.POS
            && (order.OrderDetails?.Count ?? 0) > 0)
        {
            var (previewMinLeadDays, previewMaxLeadDays) = ResolveBackorderLeadTime(order);
            var paymentStockPreview = await PreparePosStockHandlingAsync(
                order,
                order.BackorderAcceptedAt.HasValue,
                previewOnly: true,
                order.BackorderMinLeadDaysSnapshot ?? previewMinLeadDays,
                order.BackorderMaxLeadDaysSnapshot ?? previewMaxLeadDays,
                ct);
            if (paymentStockPreview.BackorderRequired)
            {
                throw new OrderValidationException(
                    "Tồn kho đã thay đổi sau khi tạo mã QR. Thanh toán chưa được ghi nhận; cần khách xác nhận chờ hàng trước khi xử lý lại.");
            }
        }

        if (hasPendingTransfer
            && order.OrderChannel == OrderChannel.POS
            && HasCustomIngredients(order))
        {
            var (previewMinLeadDays, previewMaxLeadDays) = ResolveBackorderLeadTime(order);
            var customPreview = await PrepareCustomMaterialsHandlingAsync(
                order,
                order.BackorderAcceptedAt.HasValue,
                previewOnly: true,
                order.BackorderMinLeadDaysSnapshot ?? previewMinLeadDays,
                order.BackorderMaxLeadDaysSnapshot ?? previewMaxLeadDays,
                ct);
            if (customPreview.BackorderRequired)
            {
                throw new OrderValidationException(
                    "Tồn nguyên liệu gói custom đã thay đổi sau khi tạo mã QR. Cần khách xác nhận chờ hàng trước khi xử lý lại.");
            }
        }

        var completionTarget = order.BackorderAcceptedAt.HasValue
            ? OrderStatus.WaitingMaterials
            : OrderStatus.Completed;
        var claimed = await _orderRepo.TryTransitionStatusAsync(
            order.Id,
            order.OrderStatus,
            completionTarget,
            ct);
        if (!claimed)
        {
            var current = await _orderRepo.GetByIdAsync(order.Id, ct)
                ?? throw new OrderNotFoundException(order.Id);
            if (current.OrderStatus == completionTarget)
                return;
            if (current.OrderStatus == OrderStatus.Cancelled)
                throw new OrderValidationException(
                    "Thanh toán đã bị hủy trước khi giao dịch được xác nhận.");
            throw new OrderValidationException(
                "Trạng thái đơn vừa thay đổi; không thể hoàn tất giao dịch này.");
        }

        order.OrderStatus = completionTarget;
        order.UpdatedAt = DateTime.UtcNow;
        if (completionTarget == OrderStatus.Completed)
            order.CompletedAt ??= order.UpdatedAt;

        var newlySucceededCashAmount = 0m;
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

                if (payment.PaymentMethod == PaymentMethod.Cash && order.OrderChannel == OrderChannel.POS)
                    newlySucceededCashAmount += paidNow;

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
            completionTarget == OrderStatus.Completed
                ? OrderActivityType.Completed
                : OrderActivityType.Updated,
            completionTarget == OrderStatus.Completed
                ? "Hoàn tất đơn hàng."
                : "Đã xác nhận thanh toán; đơn chuyển sang chờ đủ nguyên liệu.",
            actorId,
            actorName,
            ct);

        // Persist the winning terminal state and all payment allocations before invoking
        // synchronous stock handling. A cancellation racing after this point must lose.
        await _orderRepo.SaveChangesAsync(ct);

        InventoryStockHandlingResponse? stockHandling = null;
        if (ShouldHandlePosStockSynchronously(order))
        {
            var (minLeadDays, maxLeadDays) = ResolveBackorderLeadTime(order);
            stockHandling = await PreparePosStockHandlingAsync(
                order,
                order.BackorderAcceptedAt.HasValue,
                previewOnly: false,
                order.BackorderMinLeadDaysSnapshot ?? minLeadDays,
                order.BackorderMaxLeadDaysSnapshot ?? maxLeadDays,
                ct);
            if (stockHandling.BackorderRequired)
                throw new OrderValidationException(
                    "Tồn kho đã thay đổi sau khi tạo yêu cầu thanh toán và khách chưa xác nhận chờ hàng.");
            order.OrderStatus = ResolvePosStockHandlingStatus(stockHandling, order.OrderStatus);
            ApplyFulfillmentSnapshot(
                order,
                stockHandling,
                order.FulfillmentPreference ?? FulfillmentPreference.PartialDelivery);
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
        else
        {
            MarkCustomOnlyInventorySyncedIfApplicable(order);
        }

        if (order.OrderChannel == OrderChannel.POS && HasCustomIngredients(order))
        {
            var (minLeadDays, maxLeadDays) = ResolveBackorderLeadTime(order);
            var customHandling = await PrepareCustomMaterialsHandlingAsync(
                order,
                order.BackorderAcceptedAt.HasValue,
                previewOnly: false,
                order.BackorderMinLeadDaysSnapshot ?? minLeadDays,
                order.BackorderMaxLeadDaysSnapshot ?? maxLeadDays,
                ct);
            if (customHandling.BackorderRequired)
                throw new OrderValidationException(
                    "Tồn nguyên liệu gói custom đã thay đổi và khách chưa xác nhận chờ hàng.");

            if (string.Equals(
                    customHandling.StockHandlingMode,
                    "BackorderAccepted",
                    StringComparison.OrdinalIgnoreCase))
            {
                order.OrderStatus = PreferHeavierOrderStatus(
                    order.OrderStatus,
                    OrderStatus.WaitingMaterials);
            }

            MarkCustomOnlyInventorySyncedIfApplicable(order);
            await RecordActivityAsync(
                order.Id,
                OrderActivityType.InventorySynced,
                customHandling.Message,
                actorId,
                actorName,
                ct);
        }

        // G4: enqueue trước SaveChanges để atomic với transaction hoàn tất đơn.
        if (!ShouldSuppressLegacyOrderPlacedEvent(order, stockHandling))
        {
            await _eventPublisher.PublishOrderPlacedAsync(
                order.Id, order.OrderCode, OrderStatus.Completed.ToString(), order.OrderChannel.ToString(), order.FinalAmount,
                (order.OrderDetails ?? []).Select(d => (d.SkuId, d.SkuSnapshotName, d.SkuSnapshotCode, d.Quantity)),
                order.CustomerSnapshotName,
                ct);
        }

        decimal completedDebt = 0;
        if (order.OrderStatus == OrderStatus.Completed && order.CustomerId.HasValue)
        {
            var paidAmount = payments.Where(p => p.PaymentStatus == PaymentStatus.Success).Sum(p => p.Amount);
            completedDebt = Math.Max(0, order.FinalAmount - paidAmount);
            await EnqueueOrderCompletedAsync(order, completedDebt, ct);
        }

        var shouldSendInvoice = order.OrderStatus is
            OrderStatus.Completed or OrderStatus.WaitingTransfer or OrderStatus.WaitingProduction
            or OrderStatus.WaitingMaterials;

        // B6: đơn hợp đồng còn dư nợ khi bàn giao → ghi một dòng Deferred để phân biệt
        // "đã ghi nợ theo điều khoản" với "payment chưa xử lý".
        if (completedDebt > 0
            && OrderAccessContext.IsContractOrder(order)
            && !payments.Any(p => p.PaymentMethod == PaymentMethod.Debt))
        {
            var debtRecordedAt = DateTime.UtcNow;
            await _paymentRepo.AddAsync(new Payment
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                PaymentMethod = PaymentMethod.Debt,
                Amount = completedDebt,
                PaymentStatus = PaymentStatus.Deferred,
                IsCodVerified = false,
                CodWarningDate = null,
                PaidAt = null,
                CreatedAt = debtRecordedAt,
                UpdatedAt = debtRecordedAt
            }, ct);

            await RecordActivityAsync(
                order.Id,
                OrderActivityType.PaymentPending,
                order.DueDate.HasValue
                    ? $"Ghi nợ {completedDebt:N0}đ theo điều khoản hợp đồng, hạn thanh toán {order.DueDate.Value:dd/MM/yyyy}."
                    : $"Ghi nợ {completedDebt:N0}đ theo điều khoản hợp đồng.",
                actorId,
                actorName,
                ct);
        }

        await _orderRepo.SaveChangesAsync(ct);

        if (newlySucceededCashAmount > 0)
            await _posCashSessionLogic.RecordCashSaleAsync(newlySucceededCashAmount, ct);

        if (shouldSendInvoice)
            TrySendInvoiceEmail(order);
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

        // G4: enqueue chỉ track OutboxMessage; cần SaveChanges để persist row cho dispatcher.
        await _orderRepo.SaveChangesAsync(ct);
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
        EnsureCanModify(order, access);
        await _shiftGuard.EnsureShelfOnDutyAsync(access, ct);

        if (order.OrderStatus != OrderStatus.Completed)
            throw new OrderValidationException("Chỉ trả hàng trên hóa đơn đã hoàn tất.");

        await RepairMissingPosTierDiscountAsync(order, ct);

        var returnInputs = (req.Items ?? []).Where(i => i.ReturnQuantity > 0).ToList();
        if (returnInputs.Count == 0)
            throw new OrderValidationException("Chọn ít nhất một dòng hàng để trả.");

        var returnNote = BuildReturnNote(req);

        var detailById = (order.OrderDetails ?? []).ToDictionary(d => d.Id);
        var pendingByDetail = await _returnOrderRepo.GetPendingReturnQuantitiesByOrderIdAsync(order.Id, ct);
        var returnLines = new List<(OrderDetail Detail, int Quantity)>();

        foreach (var input in returnInputs)
        {
            if (!detailById.TryGetValue(input.OrderDetailId, out var detail))
                throw new OrderValidationException($"Dòng hàng không thuộc đơn {order.OrderCode}.");

            var pendingQty = pendingByDetail.GetValueOrDefault(detail.Id);
            var remaining = detail.Quantity - detail.ReturnedQuantity - pendingQty;
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

        // Phase 2/3: Fail policy → không tạo Request.
        ReturnPolicyAcceptanceResult? policyAcceptance = null;
        if (_returnPolicyLogic is not null)
        {
            policyAcceptance = await _returnPolicyLogic.EvaluateAcceptanceAsync(order, req, access, ct);
        }

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
            AcceptanceStatus = ReturnAcceptanceStatus.Pending,
            ExchangeManualDiscount = manualExchangeDiscount,
            ExchangeDraftJson = exchangeItems.Count > 0
                ? JsonSerializer.Serialize(exchangeItems)
                : null,
            PolicyId = policyAcceptance?.Policy.Id,
            PolicyCode = policyAcceptance?.Policy.Code,
            PolicyVersion = policyAcceptance?.Policy.Version,
            ChecklistAnswersJson = policyAcceptance?.ChecklistAnswersJson,
            PolicyEvaluationNote = policyAcceptance?.EvaluationNote,
            AcceptedBySystem = policyAcceptance is not null && !policyAcceptance.ManagerOverrideApplied,
            ManagerOverride = policyAcceptance?.ManagerOverrideApplied ?? false,
            PolicyAcceptedAt = policyAcceptance is not null ? now : null,
            EvidenceImages = (policyAcceptance?.EvidenceImageUrls ?? [])
                .Select((url, index) => new ReturnOrderEvidenceImage
                {
                    Id = Guid.NewGuid(),
                    ReturnOrderId = returnId,
                    ImageUrl = url,
                    SortOrder = index,
                    CreatedAt = now,
                })
                .ToList(),
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

        // Phase 4: Request chưa tăng ReturnedQuantity / chưa hoàn tiền / chưa OrderReturned.
        await _returnOrderRepo.AddAsync(returnOrder, ct);
        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Updated,
            $"Yêu cầu trả hàng {returnCode}: chờ Accept (chưa hoàn tiền, chưa tạo kiểm định kho).",
            actorId,
            actorName,
            ct);
        await _returnOrderRepo.SaveChangesAsync(ct);

        var autoAccept = _returnPolicyLogic is null
            || policyAcceptance is null
            || policyAcceptance.Policy.AutoAcceptOnPolicyPass
            || policyAcceptance.ManagerOverrideApplied;

        if (autoAccept)
            return await AcceptReturnAsync(returnId, access, actorId, actorName, ct, systemAutoAccept: true);

        // Notify Manager: return request needs approval
        _ = _notificationClient.SendBroadcastAsync(
            "Manager",
            NotificationTypes.ReturnRequestPendingApproval,
            $"Yêu cầu trả hàng {returnCode} cho đơn {order.OrderCode} cần duyệt",
            $"/orders/returns/{returnId}");

        return new ReturnOrderResponse(
            returnId,
            returnCode,
            order.Id,
            order.OrderCode,
            returnAmount,
            exchangeAmount,
            netCustomerPays,
            refundAmount,
            null,
            null,
            ReturnAcceptanceStatus.Pending.ToString(),
            null);
    }

    /// <summary>
    /// Phase 4: Accept → tăng ReturnedQuantity, hoàn tiền, publish OrderReturned (→ ReturnInspection).
    /// Idempotent nếu đã Accepted.
    /// </summary>
    public async Task<ReturnOrderResponse> AcceptReturnAsync(
        Guid returnId,
        OrderAccessContext access,
        Guid? actorId = null,
        string? actorName = null,
        CancellationToken ct = default,
        bool systemAutoAccept = false)
    {
        var returnOrder = await _returnOrderRepo.GetTrackedByIdAsync(returnId, ct)
            ?? throw new ReturnOrderNotFoundException(returnId);

        if (returnOrder.AcceptanceStatus == ReturnAcceptanceStatus.Accepted)
        {
            var exchangeCode = returnOrder.ExchangeOrderId.HasValue
                ? await _returnOrderRepo.GetExchangeOrderCodeAsync(returnOrder.ExchangeOrderId.Value, ct)
                : null;
            return new ReturnOrderResponse(
                returnOrder.Id,
                returnOrder.ReturnCode,
                returnOrder.SourceOrderId,
                returnOrder.SourceOrderCode,
                returnOrder.ReturnAmount,
                returnOrder.ExchangeAmount,
                returnOrder.NetCustomerPays,
                returnOrder.RefundAmount,
                returnOrder.ExchangeOrderId,
                exchangeCode,
                ReturnAcceptanceStatus.Accepted.ToString(),
                returnOrder.AcceptedAt);
        }

        if (returnOrder.AcceptanceStatus == ReturnAcceptanceStatus.Rejected)
            throw new OrderValidationException("Phiếu trả đã bị từ chối, không thể Accept.");

        var order = await _orderRepo.GetByIdAsync(returnOrder.SourceOrderId, ct)
            ?? throw new OrderNotFoundException(returnOrder.SourceOrderId);
        EnsureCanModify(order, access);

        // Manual Accept từ API: chỉ Manager/Admin. System auto-accept bỏ qua check này.
        if (!systemAutoAccept && !access.CanViewAllOrders)
            throw new OrderValidationException("Chỉ Quản lý / Admin mới Accept phiếu trả đang chờ duyệt.");

        if (!systemAutoAccept)
            await _shiftGuard.EnsureShelfOnDutyAsync(access, ct);

        var detailById = (order.OrderDetails ?? []).ToDictionary(d => d.Id);
        var now = DateTime.UtcNow;

        foreach (var line in returnOrder.Details ?? [])
        {
            if (!detailById.TryGetValue(line.SourceOrderDetailId, out var detail))
                throw new OrderValidationException(
                    $"Dòng hàng gốc không còn trên đơn {order.OrderCode}.");

            var remaining = detail.Quantity - detail.ReturnedQuantity;
            if (line.ReturnQuantity > remaining)
                throw new OrderValidationException(
                    $"Số lượng trả vượt quá còn lại ({remaining}) cho {detail.SkuSnapshotName}.");

            detail.ReturnedQuantity += line.ReturnQuantity;
            detail.UpdatedAt = now;
        }

        returnOrder.AcceptanceStatus = ReturnAcceptanceStatus.Accepted;
        returnOrder.AcceptedAt = now;
        returnOrder.UpdatedAt = now;

        var returnDescription = returnOrder.RefundAmount > 0
            ? $"Accept trả hàng {returnOrder.ReturnCode}: hoàn {FormatVnd(returnOrder.RefundAmount)} qua {GetPaymentMethodLabel(returnOrder.RefundMethod)}."
            : returnOrder.ExchangeAmount > 0
                ? $"Accept trả hàng {returnOrder.ReturnCode}: đổi/mua thêm, khách trả thêm {FormatVnd(returnOrder.NetCustomerPays)}."
                : $"Accept trả hàng {returnOrder.ReturnCode}: hoàn {FormatVnd(returnOrder.ReturnAmount)}.";

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Returned,
            returnDescription,
            actorId,
            actorName,
            ct);

        await _eventPublisher.PublishOrderReturnedAsync(
            returnOrder.Id,
            returnOrder.ReturnCode,
            order.Id,
            order.OrderCode,
            order.CustomerId,
            returnOrder.ReturnAmount,
            order.FinalAmount,
            returnOrder.RefundAmount,
            (returnOrder.Details ?? []).Select(d => (
                d.SkuId,
                d.SkuSnapshotName,
                d.SkuSnapshotCode,
                d.ReturnQuantity)),
            ct);

        await _returnOrderRepo.SaveChangesAsync(ct);

        if (!systemAutoAccept && order.EmployeeId.HasValue)
            _ = _notificationClient.SendDirectAsync(
                order.EmployeeId.Value,
                NotificationTypes.ReturnRequestApproved,
                $"Yêu cầu trả hàng {returnOrder.ReturnCode} cho đơn {order.OrderCode} đã được duyệt",
                $"/orders/returns/{returnOrder.Id}");

        if (returnOrder.RefundAmount > 0
            && returnOrder.RefundMethod == PaymentMethod.Cash
            && order.OrderChannel == OrderChannel.POS)
            await _posCashSessionLogic.RecordCashRefundAsync(returnOrder.RefundAmount, ct);

        string? exchangeOrderCode = null;
        Guid? exchangeOrderId = returnOrder.ExchangeOrderId;

        if (!exchangeOrderId.HasValue
            && !string.IsNullOrWhiteSpace(returnOrder.ExchangeDraftJson))
        {
            List<ReturnExchangeItemRequest>? exchangeItems;
            try
            {
                exchangeItems = JsonSerializer.Deserialize<List<ReturnExchangeItemRequest>>(
                    returnOrder.ExchangeDraftJson);
            }
            catch (JsonException)
            {
                throw new OrderValidationException("Draft hàng đổi không hợp lệ trên phiếu trả.");
            }

            exchangeItems = (exchangeItems ?? []).Where(i => i.Quantity > 0).ToList();
            if (exchangeItems.Count > 0)
            {
                var membershipDiscount = await GetMembershipTierDiscountAsync(
                    order.CustomerId, returnOrder.ExchangeAmount, ct);
                var manualExchangeDiscount = Math.Max(0, returnOrder.ExchangeManualDiscount);
                var returnCredit = Math.Min(returnOrder.ReturnAmount, returnOrder.ExchangeAmount);
                var exchangeDiscount = Math.Min(
                    returnOrder.ExchangeAmount,
                    returnCredit + membershipDiscount + manualExchangeDiscount);
                var exchangePaymentMethod = returnOrder.RefundMethod;
                var isExchangeTransferQr = returnOrder.NetCustomerPays > 0
                    && exchangePaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer;
                var exchangePaidAmount = isExchangeTransferQr ? 0m : returnOrder.CustomerPaidAmount;
                var exchangeTransferQrAmount = isExchangeTransferQr ? returnOrder.NetCustomerPays : 0m;

                var exchangeOrder = await CreateAsync(
                    new CreateOrderRequest(
                        order.CustomerId,
                        order.CustomerSnapshotName,
                        actorId,
                        order.OrderChannel,
                        order.ShippingAddress,
                        $"Đổi hàng từ {order.OrderCode} ({returnOrder.ReturnCode})",
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

                // Reload tracked return (CreateAsync may have flushed context).
                var tracked = await _returnOrderRepo.GetTrackedByIdAsync(returnOrder.Id, ct)
                    ?? throw new ReturnOrderNotFoundException(returnOrder.Id);
                tracked.ExchangeOrderId = exchangeOrderId;
                tracked.ExchangeDraftJson = null;
                tracked.UpdatedAt = DateTime.UtcNow;
                await _returnOrderRepo.SaveChangesAsync(ct);
                returnOrder = tracked;
            }
        }
        else if (exchangeOrderId.HasValue)
        {
            exchangeOrderCode = await _returnOrderRepo.GetExchangeOrderCodeAsync(exchangeOrderId.Value, ct);
        }

        return new ReturnOrderResponse(
            returnOrder.Id,
            returnOrder.ReturnCode,
            returnOrder.SourceOrderId,
            returnOrder.SourceOrderCode,
            returnOrder.ReturnAmount,
            returnOrder.ExchangeAmount,
            returnOrder.NetCustomerPays,
            returnOrder.RefundAmount,
            exchangeOrderId,
            exchangeOrderCode,
            ReturnAcceptanceStatus.Accepted.ToString(),
            returnOrder.AcceptedAt);
    }

    public async Task<ReturnOrderResponse> RejectReturnAsync(
        Guid returnId,
        RejectReturnRequest req,
        OrderAccessContext access,
        Guid? actorId = null,
        string? actorName = null,
        CancellationToken ct = default)
    {
        if (!access.CanViewAllOrders)
            throw new OrderValidationException("Chỉ Quản lý / Admin mới từ chối phiếu trả.");

        var returnOrder = await _returnOrderRepo.GetTrackedByIdAsync(returnId, ct)
            ?? throw new ReturnOrderNotFoundException(returnId);

        if (returnOrder.AcceptanceStatus == ReturnAcceptanceStatus.Rejected)
        {
            return new ReturnOrderResponse(
                returnOrder.Id,
                returnOrder.ReturnCode,
                returnOrder.SourceOrderId,
                returnOrder.SourceOrderCode,
                returnOrder.ReturnAmount,
                returnOrder.ExchangeAmount,
                returnOrder.NetCustomerPays,
                returnOrder.RefundAmount,
                returnOrder.ExchangeOrderId,
                null,
                ReturnAcceptanceStatus.Rejected.ToString(),
                returnOrder.AcceptedAt);
        }

        if (returnOrder.AcceptanceStatus == ReturnAcceptanceStatus.Accepted)
            throw new OrderValidationException("Phiếu trả đã Accept, không thể từ chối.");

        var order = await _orderRepo.GetByIdAsync(returnOrder.SourceOrderId, ct)
            ?? throw new OrderNotFoundException(returnOrder.SourceOrderId);
        EnsureCanView(order, access);

        var now = DateTime.UtcNow;
        var reason = string.IsNullOrWhiteSpace(req.Reason) ? null : req.Reason.Trim();
        if (reason is { Length: > 500 })
            reason = reason[..500];

        returnOrder.AcceptanceStatus = ReturnAcceptanceStatus.Rejected;
        returnOrder.RejectedAt = now;
        returnOrder.RejectionReason = reason;
        returnOrder.UpdatedAt = now;
        returnOrder.ExchangeDraftJson = null;

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Updated,
            string.IsNullOrWhiteSpace(reason)
                ? $"Từ chối yêu cầu trả hàng {returnOrder.ReturnCode}."
                : $"Từ chối yêu cầu trả hàng {returnOrder.ReturnCode}: {reason}",
            actorId,
            actorName,
            ct);

        await _returnOrderRepo.SaveChangesAsync(ct);

        if (order.EmployeeId.HasValue)
            _ = _notificationClient.SendDirectAsync(
                order.EmployeeId.Value,
                NotificationTypes.ReturnRequestRejected,
                $"Yêu cầu trả hàng {returnOrder.ReturnCode} cho đơn {order.OrderCode} bị từ chối",
                $"/orders/returns/{returnOrder.Id}");

        return new ReturnOrderResponse(
            returnOrder.Id,
            returnOrder.ReturnCode,
            returnOrder.SourceOrderId,
            returnOrder.SourceOrderCode,
            returnOrder.ReturnAmount,
            returnOrder.ExchangeAmount,
            returnOrder.NetCustomerPays,
            returnOrder.RefundAmount,
            null,
            null,
            ReturnAcceptanceStatus.Rejected.ToString(),
            null);
    }

    public async Task MarkInventorySyncedAsync(Guid orderId, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);

        if (order.InventorySyncStatus == InventorySyncStatus.Synced
            && order.OrderStatus is not (OrderStatus.WaitingMaterials
                or OrderStatus.WaitingTransfer
                or OrderStatus.WaitingProduction))
            return;

        order.InventorySyncStatus = InventorySyncStatus.Synced;
        order.UpdatedAt = DateTime.UtcNow;

        var completedForPickup = false;
        // POS-06: KB2/KB3 khách đang chờ tại quầy nên hoàn thành luôn;
        // KB4 khách đã về nên chỉ sẵn sàng giao, chờ Sale bấm "Đã giao hàng".
        var readyToDeliver = false;
        if (order.OrderStatus is OrderStatus.WaitingMaterials
            or OrderStatus.WaitingTransfer
            or OrderStatus.WaitingProduction)
        {
            var pickupAtStore = string.IsNullOrWhiteSpace(order.ShippingAddress);
            if (!pickupAtStore)
            {
                order.OrderStatus = OrderStatus.Processing;
            }
            else if (order.OrderStatus == OrderStatus.WaitingMaterials)
            {
                readyToDeliver = true;
                order.OrderStatus = OrderStatus.ReadyToDeliver;
            }
            else
            {
                completedForPickup = true;
                order.OrderStatus = OrderStatus.Completed;
                order.CompletedAt ??= DateTime.UtcNow;
            }

            foreach (var detail in order.OrderDetails ?? [])
            {
                detail.BackorderQuantity = 0;
                if (completedForPickup || readyToDeliver)
                {
                    detail.ImmediateFulfilledQuantity = detail.Quantity;
                    detail.ReservedFinishedQuantity = 0;
                }
                detail.UpdatedAt = DateTime.UtcNow;
            }
        }

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.InventorySynced,
            "Đã trừ tồn kho thành công.",
            actorId: null,
            actorName: "Hệ thống",
            ct);

        if (readyToDeliver)
        {
            await RecordActivityAsync(
                order.Id,
                OrderActivityType.Updated,
                "Đã đủ hàng; đơn sẵn sàng giao, chờ khách quay lại lấy.",
                actorId: null,
                actorName: "Hệ thống",
                ct);
        }
        else if (completedForPickup)
        {
            await RecordActivityAsync(
                order.Id,
                OrderActivityType.Completed,
                "Đã đủ nguyên liệu và hoàn tất đơn nhận tại cửa hàng.",
                actorId: null,
                actorName: "Hệ thống",
                ct);

            if (order.CustomerId.HasValue)
            {
                var paidAmount = (order.Payments ?? [])
                    .Where(payment => payment.PaymentStatus == PaymentStatus.Success)
                    .Sum(payment => payment.Amount);
                await EnqueueOrderCompletedAsync(
                    order,
                    Math.Max(0, order.FinalAmount - paidAmount),
                    ct);
            }
        }
        else if (order.OrderStatus == OrderStatus.Processing)
        {
            await RecordActivityAsync(
                order.Id,
                OrderActivityType.Updated,
                "Đã đủ nguyên liệu; đơn giao hàng chuyển sang đang xử lý.",
                actorId: null,
                actorName: "Hệ thống",
                ct);
        }

        await _orderRepo.SaveChangesAsync(ct);

        if (order.EmployeeId.HasValue)
        {
            if (readyToDeliver)
                _ = _notificationClient.SendDirectAsync(
                    order.EmployeeId.Value,
                    NotificationTypes.OrderReadyForPickup,
                    $"Đơn {order.OrderCode} đã đủ hàng, chờ khách đến lấy",
                    $"/orders/{order.Id}");
            else
                _ = _notificationClient.SendDirectAsync(
                    order.EmployeeId.Value,
                    NotificationTypes.StockQueueConfirmed,
                    $"Kho đã xác nhận trừ tồn cho đơn {order.OrderCode}",
                    $"/orders/{order.Id}");
        }

        if (completedForPickup && order.CustomerId.HasValue)
            TrySendInvoiceEmail(order);
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

        var now = DateTime.UtcNow;
        order.InventorySyncStatus = InventorySyncStatus.Cancelled;
        order.UpdatedAt = now;

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

        // POS-06a: queue backorder bị hủy → đơn không thể tự thoát trạng thái chờ nữa.
        // Đã thu tiền thì phải qua duyệt hoàn tiền; chưa thu tiền thì hủy thẳng.
        if (order.OrderStatus is OrderStatus.WaitingMaterials
            or OrderStatus.WaitingTransfer
            or OrderStatus.WaitingProduction)
        {
            var payments = order.Payments ?? await GetPaymentsInternal(order.Id, ct);
            var collectedAmount = payments
                .Where(payment => payment.PaymentStatus == PaymentStatus.Success)
                .Sum(payment => payment.Amount);

            if (collectedAmount > 0)
            {
                order.OrderStatus = OrderStatus.CancellationRequested;
                order.RefundStatus = BackorderRefundStatus.PendingApproval;
                order.RefundAmount = collectedAmount;
                order.CancellationReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
                order.CancellationRequestedAt = now;

                await RecordActivityAsync(
                    order.Id,
                    OrderActivityType.Updated,
                    $"Kho đã hủy phiếu chờ nguyên liệu. Chờ Manager duyệt hoàn {FormatVnd(collectedAmount)}.",
                    actorId: null,
                    actorName: "Hệ thống",
                    ct);
            }
            else
            {
                order.OrderStatus = OrderStatus.Cancelled;
                order.CancellationReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();

                foreach (var payment in payments)
                {
                    if (payment.PaymentStatus != PaymentStatus.Success)
                    {
                        payment.PaymentStatus = PaymentStatus.Failed;
                        payment.UpdatedAt = now;
                    }
                }

                await RecordActivityAsync(
                    order.Id,
                    OrderActivityType.Cancelled,
                    "Kho đã hủy phiếu chờ nguyên liệu nên đơn hàng bị hủy.",
                    actorId: null,
                    actorName: "Hệ thống",
                    ct);
            }
        }

        await _orderRepo.SaveChangesAsync(ct);
    }

    private Task EnqueueOrderCompletedAsync(Order order, decimal debtAmount, CancellationToken ct)
    {
        if (!order.CustomerId.HasValue) return Task.CompletedTask;
        return PublishOrderCompletedEventAsync(order, debtAmount, ct);
    }

    private void TrySendInvoiceEmail(Order order)
    {
        if (!order.CustomerId.HasValue) return;

        _ = Task.Run(async () =>
        {
            try
            {
                var customer = await _customerCatalogClient.GetCustomerAsync(order.CustomerId.Value, CancellationToken.None);
                if (customer is not null && !string.IsNullOrWhiteSpace(customer.Email))
                {
                    await _emailService.SendInvoiceEmailAsync(
                        customer.Email, customer.FullName ?? "Quý khách", customer.TierName, order, CancellationToken.None);
                }
            }
            catch
            {
                // Email là side-effect thông báo, không được ảnh hưởng tới kết quả nghiệp vụ.
            }
        });
    }

    private Task PublishOrderCompletedEventAsync(
        Order order,
        decimal debtAmount,
        CancellationToken ct)
    {
        if (!order.CustomerId.HasValue)
            return Task.CompletedTask;

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
        && order.OrderStatus is OrderStatus.Completed or OrderStatus.WaitingMaterials
        && (order.OrderDetails?.Count ?? 0) > 0;

    /// <summary>
    /// Đơn chỉ có gói custom: không trừ thành phẩm Kệ qua PreparePosStockDeduction.
    /// Nguyên liệu trừ lúc đóng gói (PackCustomBundle). Tránh kẹt PendingDeduction / badge «Chờ trừ tồn quầy».
    /// </summary>
    private static void MarkCustomOnlyInventorySyncedIfApplicable(Order order)
    {
        if (order.InventorySyncStatus != InventorySyncStatus.PendingDeduction)
            return;
        if ((order.OrderDetails?.Count ?? 0) > 0)
            return;
        if (!(order.CustomBundles?.Any(b => (b.Ingredients?.Count ?? 0) > 0) ?? false))
            return;

        order.InventorySyncStatus = InventorySyncStatus.Synced;
    }

    /// <summary>
    /// COD sell-first: đồng bộ prepare lúc tạo đơn (reserve-only), map Waiting* giống POS.
    /// </summary>
    private static bool ShouldHandleCodStockSynchronously(Order order) =>
        order.OrderChannel == OrderChannel.COD
        && (order.OrderDetails?.Count ?? 0) > 0;

    /// <summary>
    /// POS-06: ánh xạ mode do InventoryService trả về sang trạng thái đơn.
    /// KB1 hoàn thành ngay; KB2/KB3 chờ Thủ kho sinh chứng từ; KB4 chờ khách quay lại lấy.
    /// </summary>
    private static OrderStatus ResolvePosStockHandlingStatus(
        InventoryStockHandlingResponse stockHandling,
        OrderStatus currentStatus) =>
        stockHandling.StockHandlingMode switch
        {
            "WarehouseTransferPending" => OrderStatus.WaitingTransfer,
            "PartialOrFullPendingBomReconciliation" => OrderStatus.WaitingProduction,
            "BackorderAccepted" => OrderStatus.WaitingMaterials,
            _ => stockHandling.HasPendingStockReconciliation ? currentStatus : OrderStatus.Completed
        };

    /// <summary>
    /// COD: Immediate giữ PendingPayment (chưa thu); các mode chờ Thủ kho/nguyên liệu như POS.
    /// </summary>
    private static OrderStatus ResolveCodStockHandlingStatus(
        InventoryStockHandlingResponse stockHandling,
        OrderStatus currentStatus) =>
        stockHandling.StockHandlingMode switch
        {
            "WarehouseTransferPending" => OrderStatus.WaitingTransfer,
            "PartialOrFullPendingBomReconciliation" => OrderStatus.WaitingProduction,
            "BackorderAccepted" => OrderStatus.WaitingMaterials,
            _ => currentStatus
        };

    private static void EnsureIdempotentOrderCanBeReturned(Order order)
    {
        // The idempotency claim is deliberately persisted before calling InventoryService.
        // If that remote call fails, the retry must not look like a successful checkout:
        // the POS UI would otherwise print a receipt for stock that was never deducted.
        if (order.OrderChannel == OrderChannel.POS
            && order.InventorySyncStatus == InventorySyncStatus.PendingDeduction)
        {
            throw new OrderDependencyUnavailableException(
                "Đơn POS trước đó chưa đồng bộ được tồn kho. Hóa đơn chưa được xác nhận; vui lòng thử lại sau khi kiểm tra dịch vụ Kho.");
        }
    }

    /// <summary>
    /// POS luôn suppress; COD suppress khi đã sync prepare (tránh OrderPlaced tạo queue/reserve lần 2).
    /// </summary>
    private static bool ShouldSuppressLegacyOrderPlacedEvent(Order order, InventoryStockHandlingResponse? stockHandling) =>
        order.OrderChannel == OrderChannel.POS
        || (order.OrderChannel == OrderChannel.COD && stockHandling is not null)
        // COD chỉ custom (không dòng TP): không publish OrderPlaced rỗng — NL trừ lúc đóng gói.
        || (order.OrderChannel == OrderChannel.COD
            && (order.OrderDetails?.Count ?? 0) == 0
            && (order.CustomBundles?.Any(b => (b.Ingredients?.Count ?? 0) > 0) ?? false));

    private async Task<InventoryStockHandlingResponse> PreparePosStockHandlingAsync(
        Order order,
        bool acceptBackorder,
        bool previewOnly,
        int backorderMinLeadDays,
        int backorderMaxLeadDays,
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
                        d.Quantity)).ToList(),
                    acceptBackorder,
                    previewOnly,
                    backorderMinLeadDays,
                    backorderMaxLeadDays,
                    order.FulfillmentPreference?.ToString(),
                    order.PickupDate,
                    order.PickupNote,
                    ReserveOnly: order.OrderChannel == OrderChannel.COD),
                ct);
        }
        catch (InventoryStockHandlingException ex)
        {
            throw new OrderValidationException(ex.Message);
        }
    }

    private static bool HasCustomIngredients(Order order) =>
        order.CustomBundles?.Any(bundle => (bundle.Ingredients?.Count ?? 0) > 0) ?? false;

    private static List<InventoryStockHandlingItemRequest> AggregateCustomMaterialItems(Order order) =>
        (order.CustomBundles ?? [])
            .SelectMany(bundle => bundle.Ingredients ?? [])
            .Where(ingredient => ingredient.MaterialSkuId != Guid.Empty && ingredient.Quantity > 0)
            .GroupBy(ingredient => ingredient.MaterialSkuId)
            .Select(group =>
            {
                var first = group.First();
                return new InventoryStockHandlingItemRequest(
                    group.Key,
                    first.MaterialSnapshotName,
                    first.MaterialSkuCode,
                    group.Sum(ingredient => ingredient.Quantity));
            })
            .OrderBy(item => item.SkuSnapshotCode ?? item.SkuSnapshotName ?? item.SkuId.ToString())
            .ToList();

    private async Task<InventoryStockHandlingResponse> PrepareCustomMaterialsHandlingAsync(
        Order order,
        bool acceptBackorder,
        bool previewOnly,
        int backorderMinLeadDays,
        int backorderMaxLeadDays,
        CancellationToken ct)
    {
        var items = AggregateCustomMaterialItems(order);
        if (items.Count == 0)
        {
            return new InventoryStockHandlingResponse(
                order.Id,
                order.OrderCode,
                "Immediate",
                false,
                "Gói custom không có nguyên liệu cần kiểm tra tồn.",
                [],
                []);
        }

        try
        {
            return await _inventoryCatalogClient.PrepareCustomMaterialsAsync(
                new InventoryCustomMaterialsRequest(
                    order.Id,
                    order.OrderCode,
                    items,
                    acceptBackorder,
                    previewOnly,
                    backorderMinLeadDays,
                    backorderMaxLeadDays),
                ct);
        }
        catch (InventoryStockHandlingException ex)
        {
            throw new OrderValidationException(ex.Message);
        }
    }

    private void ApplyBackorderAcceptedToOrder(
        Order order,
        CreateOrderRequest req,
        int backorderMinLeadDays,
        int backorderMaxLeadDays,
        InventoryStockHandlingResponse stockPreview,
        bool setWaitingMaterials)
    {
        var acceptedAt = order.BackorderAcceptedAt ?? DateTime.UtcNow;
        order.BackorderAcceptedAt = acceptedAt;
        order.BackorderMinLeadDaysSnapshot = backorderMinLeadDays;
        order.BackorderMaxLeadDaysSnapshot = backorderMaxLeadDays;
        order.EstimatedReadyFrom = acceptedAt.AddDays(backorderMinLeadDays);
        order.EstimatedReadyTo = acceptedAt.AddDays(backorderMaxLeadDays);
        // Gói custom: luôn nhận một lần khi đủ hàng (không giao từng phần NL/bao bì).
        var preference = HasCustomIngredients(order)
            ? FulfillmentPreference.CompleteDelivery
            : req.FulfillmentPreference;
        order.FulfillmentPreference = preference;
        ApplyFulfillmentSnapshot(order, stockPreview, preference);
        order.PickupDate = req.PickupDate ?? order.EstimatedReadyFrom;
        order.PickupNote = string.IsNullOrWhiteSpace(req.PickupNote) ? null : req.PickupNote.Trim();
        ApplyPickupContact(order, req);

        if (order.OrderChannel == OrderChannel.POS
            && req.DepositAmount.HasValue
            && req.DepositAmount.Value > 0)
        {
            var minimumDeposit = Math.Round(order.FinalAmount * 0.5m, 0, MidpointRounding.AwayFromZero);
            if (req.DepositAmount.Value < minimumDeposit)
            {
                throw new OrderValidationException(
                    $"Cọc tối thiểu 50% giá trị đơn hàng ({FormatVnd(minimumDeposit)}).");
            }

            order.DepositAmount = req.DepositAmount.Value;
        }

        if (setWaitingMaterials)
            order.OrderStatus = OrderStatus.WaitingMaterials;
    }

    private static OrderStatus PreferHeavierOrderStatus(OrderStatus current, OrderStatus candidate)
    {
        static int Rank(OrderStatus status) => status switch
        {
            OrderStatus.WaitingMaterials => 4,
            OrderStatus.WaitingProduction => 3,
            OrderStatus.WaitingTransfer => 2,
            OrderStatus.ReadyToDeliver => 1,
            _ => 0
        };

        return Rank(candidate) > Rank(current) ? candidate : current;
    }

    /// <summary>
    /// Fail-soft: đơn đã Cancelled + Outbox; nếu Inventory lỗi vẫn không rollback đơn — event là lớp dự phòng.
    /// </summary>
    private async Task TryCancelLinkedStockQueuesAsync(
        Guid orderId,
        string reason,
        string previousOrderStatus,
        CancellationToken ct)
    {
        try
        {
            await _inventoryCatalogClient.CancelStockQueuesForOrderAsync(
                orderId, reason, previousOrderStatus, ct);
        }
        catch (Exception)
        {
            // Outbox OrderCancelledEvent vẫn xử lý hủy queue; không chặn hủy đơn.
        }
    }

    private async Task TryFreezeLinkedStockQueuesAsync(Guid orderId, string reason, CancellationToken ct)
    {
        try
        {
            await _inventoryCatalogClient.FreezeStockQueuesForOrderCancellationAsync(orderId, reason, ct);
        }
        catch (Exception)
        {
            // Fail-soft — Confirm vẫn bị chặn khi OrderCancelled hoàn tất; freeze là lớp sớm.
        }
    }

    private async Task TryUnfreezeLinkedStockQueuesAsync(Guid orderId, CancellationToken ct)
    {
        try
        {
            await _inventoryCatalogClient.UnfreezeStockQueuesForOrderCancellationAsync(orderId, ct);
        }
        catch (Exception)
        {
        }
    }

    private (int MinLeadDays, int MaxLeadDays) ResolveBackorderLeadTime(Order order)
    {
        var windows = (order.OrderDetails ?? [])
            .Select(detail => _backorder.Resolve(
                detail.SkuId,
                detail.SkuSnapshotCode,
                detail.CategorySnapshotName))
            .ToList();
        if (windows.Count == 0)
        {
            var fallback = _backorder.Resolve(Guid.Empty, null, null);
            return (fallback.MinLeadDays, fallback.MaxLeadDays);
        }

        return (
            windows.Max(window => window.MinLeadDays),
            windows.Max(window => window.MaxLeadDays));
    }

    /// <summary>
    /// POS-06 (KB4): đơn backorder phải nhận diện được người tới lấy hàng vài ngày sau.
    /// Ưu tiên hồ sơ khách đã chọn; khách vãng lai bắt buộc nhập tên + SĐT.
    /// </summary>
    private static void ApplyPickupContact(Order order, CreateOrderRequest req)
    {
        var name = req.PickupContactName?.Trim();
        var phone = NormalizePickupPhone(req.PickupContactPhone);

        if (string.IsNullOrWhiteSpace(name))
            throw new OrderValidationException("Đơn chờ hàng phải có tên người nhận để đối chiếu khi khách quay lại.");
        if (!IsPickupContactNameValid(name))
            throw new OrderValidationException("Tên người nhận chỉ được chứa chữ cái và khoảng trắng.");
        if (phone is null)
            throw new OrderValidationException("Số điện thoại người nhận phải đúng 10 chữ số và bắt đầu bằng 0.");

        order.PickupContactName = name;
        order.PickupContactPhone = phone;
        order.PickupCode = GeneratePickupCode();
    }

    // POS-06: mọi trạng thái "khách chờ hàng" đều đã có thể thu tiền trước, nên huỷ phải qua
    // duyệt hoàn tiền của Manager thay vì huỷ thẳng.
    private static bool IsBackorderRefundGuardedStatus(OrderStatus status) =>
        status is OrderStatus.WaitingMaterials
            or OrderStatus.WaitingTransfer
            or OrderStatus.WaitingProduction
            or OrderStatus.ReadyToDeliver;

    private static bool IsPickupContactNameValid(string name) =>
        name.All(c => char.IsLetter(c) || char.IsWhiteSpace(c));

    private static string? NormalizePickupPhone(string? raw)
    {
        var digits = new string((raw ?? string.Empty).Where(char.IsDigit).ToArray());
        return digits.Length == 10 && digits[0] == '0' ? digits : null;
    }

    // Bỏ ký tự dễ đọc nhầm (0/O, 1/I) vì mã được đọc miệng tại quầy.
    private const string PickupCodeAlphabet = "23456789ACDEFGHJKLMNPQRSTUVWXYZ";

    private static string GeneratePickupCode()
    {
        var bytes = RandomNumberGenerator.GetBytes(6);
        return string.Create(6, bytes, static (span, source) =>
        {
            for (var i = 0; i < span.Length; i++)
                span[i] = PickupCodeAlphabet[source[i] % PickupCodeAlphabet.Length];
        });
    }

    private static void ApplyFulfillmentSnapshot(
        Order order,
        InventoryStockHandlingResponse stockHandling,
        FulfillmentPreference preference)
    {
        var lines = stockHandling.Lines
            .GroupBy(line => line.SkuId)
            .ToDictionary(
                group => group.Key,
                group => new
                {
                    Finished = group.Sum(line => line.FinishedDeductedQuantity),
                    Pending = group.Sum(line => line.PendingBomQuantity)
                });

        foreach (var detail in order.OrderDetails ?? [])
        {
            if (!lines.TryGetValue(detail.SkuId, out var allocation))
                continue;

            detail.BackorderQuantity = Math.Min(detail.Quantity, allocation.Pending);
            var finished = Math.Min(detail.Quantity - detail.BackorderQuantity, allocation.Finished);
            detail.ImmediateFulfilledQuantity = preference == FulfillmentPreference.PartialDelivery
                ? finished
                : 0;
            detail.ReservedFinishedQuantity = preference == FulfillmentPreference.CompleteDelivery
                ? finished
                : 0;
            detail.UpdatedAt = DateTime.UtcNow;
        }
    }

    /// <summary>
    /// POS-04 (H4): thay giữ chỗ tồn Kệ Hàng cho đơn COD đang sửa — gọi đồng bộ Inventory,
    /// all-or-nothing, idempotent theo OperationId. Inventory từ chối → OrderValidationException,
    /// đơn không được lưu.
    /// </summary>
    private async Task ReplaceCodReservationAsync(Order order, CancellationToken ct)
    {
        try
        {
            await _inventoryCatalogClient.ReplaceCodReservationAsync(
                new InventoryReservationReplaceRequest(
                    order.Id,
                    Guid.NewGuid(),
                    order.FinalAmount,
                    (order.OrderDetails ?? []).Select(d => new InventoryReservationReplaceItemRequest(
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
                line.PendingBomQuantity,
                line.WarehouseDeductedQuantity)).ToList());
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
        item.Note,
        item.AcceptanceStatus.ToString(),
        item.AcceptedAt);

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
            d.SubTotal)).ToList(),
        item.AcceptanceStatus.ToString(),
        item.AcceptedAt,
        item.RejectedAt,
        item.RejectionReason,
        item.AcceptedBySystem,
        item.ManagerOverride,
        item.PolicyCode,
        item.PolicyVersion,
        (item.EvidenceImages ?? [])
            .OrderBy(i => i.SortOrder)
            .Select(i => i.ImageUrl)
            .ToList());

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
            // Dòng ghi nợ hợp đồng là công nợ đang mở, không phải payment lỡ kẹt ở Pending.
            if (payment.PaymentMethod == PaymentMethod.Debt) continue;
            if (payment.PaymentStatus == PaymentStatus.Deferred) continue;
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

    private static decimal CalculateMembershipTierDiscount(
        CustomerCatalogProfile? customer,
        decimal amount)
    {
        if (customer is null || amount <= 0 || customer.IsVipCustomer || customer.TierDiscountPercent <= 0)
            return 0m;

        return Math.Round(
            amount * customer.TierDiscountPercent / 100m,
            0,
            MidpointRounding.AwayFromZero);
    }

    private async Task<decimal> GetMembershipTierDiscountAsync(
        Guid? customerId,
        decimal amount,
        CancellationToken ct)
    {
        if (!customerId.HasValue || customerId == Guid.Empty || amount <= 0)
            return 0m;

        var customer = await _customerCatalogClient.GetCustomerAsync(customerId.Value, ct);
        return CalculateMembershipTierDiscount(customer, amount);
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
        {
            // Đơn đã đóng gói trước khi có bước advance trạng thái — tự sửa khi mở lại.
            if (bundle.OrderId != Guid.Empty)
            {
                var order = await _orderRepo.GetByIdAsync(bundle.OrderId, ct);
                if (order is not null && await TryAdvanceOrderAfterAllCustomBundlesPackedAsync(order, ct))
                    await _orderRepo.SaveChangesAsync(ct);
            }

            return MapBundle(bundle);
        }

        // Validation tăng cường: kiểm tra lại canUseInCustom và productType tại thời điểm pack
        // để phát hiện trường hợp SKU bị disable sau khi đơn được tạo
        var profiles = await GetRequiredSkuProfilesAsync(bundle.Ingredients.Select(i => i.MaterialSkuId), ct);
        foreach (var ingredient in bundle.Ingredients)
        {
            var profile = profiles[ingredient.MaterialSkuId];
            if (ingredient.Quantity <= 0 || !profile.CanUseInCustom
                || !string.Equals(profile.ProductType, "NGUYEN_LIEU", StringComparison.OrdinalIgnoreCase)
                   && !string.Equals(profile.ProductType, "BAO_BI", StringComparison.OrdinalIgnoreCase))
                throw new OrderValidationException("SKU không còn được phép dùng trong Custom.");
        }

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
        try
        {
            await _inventoryCatalogClient.DeductMaterialsAsync(
                ingredients,
                "CustomBundle",
                bundle.Id,
                referenceCode,
                $"Dong goi custom bundle {bundle.Label ?? bundle.Id.ToString("N")[..8]}",
                ct);
        }
        catch (InventoryStockHandlingException ex)
        {
            // Inventory trả message nghiệp vụ (vd thiếu tồn Kho) — đưa lên 400 cho FE hiện rõ.
            throw new OrderValidationException(ex.Message);
        }

        bundle.PackingStatus = PackingStatus.Packed;
        bundle.PackedAt = DateTime.UtcNow;
        bundle.UpdatedAt = DateTime.UtcNow;
        await _customBundleRepo.SaveChangesAsync(ct);

        if (bundle.OrderId != Guid.Empty)
        {
            var order = await _orderRepo.GetByIdAsync(bundle.OrderId, ct);
            if (order is not null && await TryAdvanceOrderAfterAllCustomBundlesPackedAsync(order, ct))
                await _orderRepo.SaveChangesAsync(ct);
        }

        return MapBundle(bundle);
    }

    /// <summary>
    /// Sau khi mọi gói custom đã đóng gói (đã trừ NL Kho): thoát WaitingMaterials.
    /// Nhận tại quầy → ReadyToDeliver (chờ «Đã giao»); giao đi → Processing.
    /// </summary>
    private async Task<bool> TryAdvanceOrderAfterAllCustomBundlesPackedAsync(Order order, CancellationToken ct)
    {
        if (order.OrderStatus != OrderStatus.WaitingMaterials)
            return false;

        var bundles = order.CustomBundles ?? [];
        if (bundles.Count == 0)
            return false;
        if (bundles.Any(b => b.PackingStatus != PackingStatus.Packed))
            return false;

        // Còn dòng thành phẩm chờ nguyên liệu / chờ Thủ kho → chưa advance.
        if ((order.OrderDetails ?? []).Any(d => d.BackorderQuantity > 0))
            return false;
        if (order.InventorySyncStatus is InventorySyncStatus.PendingDeduction
            or InventorySyncStatus.PendingReconciliation)
            return false;

        var pickupAtStore = string.IsNullOrWhiteSpace(order.ShippingAddress);
        var nextStatus = pickupAtStore ? OrderStatus.ReadyToDeliver : OrderStatus.Processing;
        OrderStatusTransition.EnsureValidTransition(order.OrderStatus, nextStatus, order.Id);

        order.OrderStatus = nextStatus;
        order.UpdatedAt = DateTime.UtcNow;

        await RecordActivityAsync(
            order.Id,
            OrderActivityType.Updated,
            pickupAtStore
                ? "Đã đóng gói custom và trừ nguyên liệu Kho. Đơn sẵn sàng giao, chờ khách nhận hàng."
                : "Đã đóng gói custom và trừ nguyên liệu Kho. Đơn chuyển sang đang xử lý giao hàng.",
            actorId: null,
            actorName: "Hệ thống",
            ct);

        return true;
    }

    private static CustomBundleResponse MapBundle(CustomBundle b) => new(
        b.Id, b.OrderId, b.Label, b.Note, b.TotalPrice,
        b.PackingStatus.ToString(), b.PackedAt,
        (b.Ingredients ?? []).Select(i => new CustomBundleIngredientResponse(
            i.Id, i.MaterialSkuId, i.MaterialSkuCode, i.MaterialSnapshotName,
            i.Quantity, i.UnitPrice, i.SubTotal)).ToList(),
        b.Order?.OrderCode,
        b.Order?.CustomerSnapshotName,
        b.Order?.OrderStatus.ToString(),
        b.CreatedAt);

    private static OrderResponse MapToResponse(Order o, StockHandlingSummaryResponse? stockHandlingSummary = null) => new(
        o.Id, o.OrderCode, o.CustomerId, o.CustomerSnapshotName,
        o.EmployeeId, o.EmployeeSnapshotName, o.OrderChannel.ToString(), o.OrderKind.ToString(), o.OrderStatus.ToString(),
        o.InventorySyncStatus.ToString(), o.TotalAmount, o.DiscountAmount,
        o.PromotionId, o.PromotionCode, o.PromotionDiscountAmount, o.FinalAmount,
        o.ShippingAddress, o.Note, o.CreatedAt, o.UpdatedAt,
        (o.OrderDetails ?? []).Select(d => new OrderDetailResponse(
            d.Id, d.SkuId, d.SkuSnapshotName, d.SkuSnapshotCode,
            d.Quantity, d.ReturnedQuantity, d.UnitPrice, d.SubTotal, d.IsGift,
            d.ImmediateFulfilledQuantity, d.ReservedFinishedQuantity, d.BackorderQuantity)).ToList(),
        (o.Payments ?? []).Select(p => new PaymentResponse(
            p.Id, p.OrderId, o.OrderCode, o.CustomerSnapshotName,
            p.PaymentMethod.ToString(), p.Amount, p.PaymentStatus.ToString(),
            p.TransactionRef, p.IsCodVerified, p.CodWarningDate, p.PaidAt, p.CodDebtSettlementJson,
            p.PaymentPurpose.ToString())).ToList(),
        (o.CustomBundles ?? []).Select(b => new CustomBundleResponse(
            b.Id, b.OrderId, b.Label, b.Note, b.TotalPrice,
            b.PackingStatus.ToString(), b.PackedAt,
            (b.Ingredients ?? []).Select(i => new CustomBundleIngredientResponse(
                i.Id, i.MaterialSkuId, i.MaterialSkuCode, i.MaterialSnapshotName,
                i.Quantity, i.UnitPrice, i.SubTotal)).ToList())).ToList(),
        stockHandlingSummary,
        o.ContractId,
        o.ContractCodeSnapshot,
        o.ContractDiscountPercentSnapshot,
        o.ContractPaymentTermDaysSnapshot,
        o.DueDate,
        o.BackorderAcceptedAt,
        o.BackorderMinLeadDaysSnapshot,
        o.BackorderMaxLeadDaysSnapshot,
        o.EstimatedReadyFrom,
        o.EstimatedReadyTo,
        o.FulfillmentPreference?.ToString(),
        o.RefundStatus.ToString(),
        o.RefundAmount,
        o.RefundMethod,
        o.RefundEvidence,
        o.CancellationReason,
        o.CancellationRequestedAt,
        o.CancellationRequestedBy,
        o.CancellationRequestedByName,
        o.RefundApprovedAt,
        o.RefundApprovedBy,
        o.RefundApprovedByName,
        o.RefundedAt,
        o.RefundedBy,
        o.RefundedByName,
        o.PickupDate,
        o.PickupNote,
        o.DeliveredAt,
        o.DeliveredByName,
        o.PickupContactName,
        o.PickupContactPhone,
        o.PickupCode,
        o.DepositAmount,
        CalculateRemainingAmountDue(o)
    );

    /// <summary>Số tiền còn phải thu khi khách quay lại nhận hàng (đơn đặt cọc).</summary>
    private static decimal? CalculateRemainingAmountDue(Order o)
    {
        if (!o.DepositAmount.HasValue || o.DepositAmount.Value <= 0) return null;
        var collected = (o.Payments ?? [])
            .Where(p => p.PaymentStatus == PaymentStatus.Success)
            .Sum(p => p.Amount);
        return Math.Max(0, o.FinalAmount - collected);
    }

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
            ResolveCodExpectedAmount(codPayment),
            o.OrderDetails?.Sum(d => d.Quantity) ?? 0,
            HasActiveStockReservation: false,
            EmployeeSnapshotName: o.EmployeeSnapshotName,
            PickupDate: o.PickupDate);
    }

    private static decimal? ResolveCodExpectedAmount(Payment? payment)
    {
        if (payment is null || payment.IsCodVerified)
            return null;

        var fromMeta = TryReadExpectedCollectedAmount(payment.CodDebtSettlementJson);
        if (fromMeta is > 0)
            return fromMeta;

        return payment.Amount > 0 ? payment.Amount : null;
    }

    private static decimal? TryReadExpectedCollectedAmount(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;

        try
        {
            using var document = System.Text.Json.JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != System.Text.Json.JsonValueKind.Object)
                return null;

            if (!document.RootElement.TryGetProperty("expectedCollectedAmount", out var amountNode)
                && !document.RootElement.TryGetProperty("ExpectedCollectedAmount", out amountNode))
            {
                return null;
            }

            if (amountNode.ValueKind == System.Text.Json.JsonValueKind.Number
                && amountNode.TryGetDecimal(out var amount)
                && amount > 0)
            {
                return Math.Round(amount, 2, MidpointRounding.AwayFromZero);
            }

            if (amountNode.ValueKind == System.Text.Json.JsonValueKind.String
                && decimal.TryParse(
                    amountNode.GetString(),
                    NumberStyles.Number,
                    CultureInfo.InvariantCulture,
                    out var parsed)
                && parsed > 0)
            {
                return Math.Round(parsed, 2, MidpointRounding.AwayFromZero);
            }
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }

        return null;
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

    private static string? NormalizeActorName(string? actorName) =>
        string.IsNullOrWhiteSpace(actorName) ? null : actorName.Trim();

    private static string GetChannelLabel(OrderChannel channel) => channel switch
    {
        OrderChannel.POS => "bán tại quầy",
        OrderChannel.Website => "website",
        OrderChannel.Zalo => "Zalo",
        OrderChannel.Phone => "điện thoại",
        OrderChannel.COD => "COD",
        OrderChannel.B2B => "hợp đồng doanh nghiệp",
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
        PaymentMethod.Debt => "ghi nợ theo hợp đồng",
        _ => method.ToString()
    };

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
}
