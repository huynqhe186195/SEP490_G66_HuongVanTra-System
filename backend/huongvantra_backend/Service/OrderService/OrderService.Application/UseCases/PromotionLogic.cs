using System.Text.RegularExpressions;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.UseCases;

public class PromotionLogic(
    IPromotionRepository _promotionRepo,
    ICustomerCatalogClient _customerCatalogClient)
{
    private const decimal MaxPercentageDiscountValue = 90m;
    private const decimal MaxFixedDiscountValue = 10_000_000m;
    private const decimal MaxPercentageDiscountAmount = 10_000_000m;
    private const decimal MaxMinimumOrderAmount = 100_000_000m;
    private const int MaxUsageLimit = 1_000_000;
    private const int AdminPromotionPageSize = 10;
    private const string InvalidLookupMessage = "Mã giảm giá không hợp lệ hoặc đã hết hiệu lực.";
    private const string NotApplicableMessage = "Mã giảm giá không áp dụng cho sản phẩm trong đơn hàng.";
    private const string CategoryNotApplicableMessage = "Mã giảm giá không áp dụng cho danh mục trong đơn hàng.";
    private const string CustomerTierRequiredMessage =
        "Mã này chỉ áp dụng cho khách hàng đã đăng ký thuộc hạng phù hợp.";
    private const string CustomerNotFoundMessage = "Không tìm thấy thông tin khách hàng.";
    private const string CustomerTierNotApplicableMessage =
        "Mã này chỉ áp dụng cho khách hàng đã đăng ký thuộc hạng phù hợp.";
    private static readonly TimeSpan ValidFromPastTolerance = TimeSpan.FromMinutes(2);
    private static readonly Regex PromoCodeRegex = new("^[A-Z0-9_-]+$", RegexOptions.Compiled);

    public async Task<PagedResponse<PromotionResponse>> GetAdminPromotionsAsync(
        GetAdminPromotionsRequest req, CancellationToken ct = default)
    {
        var page = req.Page < 1 ? 1 : req.Page;
        var pageSize = AdminPromotionPageSize;
        var discountType = ParseAdminDiscountTypeFilter(req.DiscountType);
        var scopeType = ParseAdminScopeTypeFilter(req.ScopeType);
        var effectiveStatus = ParseAdminStatusFilter(req.Status);
        var nowUtc = DateTime.UtcNow;

        var (promotions, totalCount) = await _promotionRepo.GetPagedAsync(
            req.Search,
            discountType,
            scopeType,
            effectiveStatus,
            nowUtc,
            page,
            pageSize,
            ct);
        var result = new List<PromotionResponse>(promotions.Count);

        foreach (var promotion in promotions)
        {
            var orderCount = await _promotionRepo.CountOrdersUsingPromotionAsync(promotion.Id, ct);
            result.Add(MapToResponse(promotion, orderCount));
        }

        var totalPages = totalCount == 0
            ? 1
            : (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PagedResponse<PromotionResponse>(
            result,
            page,
            pageSize,
            totalCount,
            totalPages);
    }

    public async Task<List<PromotionLookupResponse>> GetAvailablePromotionsAsync(CancellationToken ct = default)
    {
        var promotions = await _promotionRepo.GetAvailableAsync(DateTime.UtcNow, ct);
        var result = new List<PromotionLookupResponse>(promotions.Count);

        foreach (var promotion in promotions)
        {
            var usedTotal = await _promotionRepo.CountOrdersUsingPromotionAsync(promotion.Id, ct);
            result.Add(MapToLookupResponse(promotion, usedTotal));
        }

        return result;
    }

    public async Task<List<PromotionLookupResponse>> GetApplicablePromotionsAsync(
        PromotionApplyPreviewRequest req,
        CancellationToken ct = default)
    {
        var items = ValidatePreviewItems(req.Items);
        var promotions = await _promotionRepo.GetAvailableAsync(DateTime.UtcNow, ct);
        var totalAmount = items.Sum(i => i.SubTotal);
        var safeManualDiscount = Math.Min(Math.Max(0, req.ManualDiscount), totalAmount);
        var candidates = new List<ApplicablePromotionCandidate>();

        foreach (var promotion in promotions)
        {
            try
            {
                var usage = await ValidateUsageLimitsAsync(promotion, req.CustomerId, ct);
                await ValidateCustomerTierEligibilityAsync(promotion, req.CustomerId, ct);
                var calculation = CalculatePromotionDiscount(promotion, items, req.ManualDiscount);
                var estimatedFinalTotal = Math.Max(
                    0,
                    totalAmount - safeManualDiscount - calculation.DiscountAmount);

                candidates.Add(new ApplicablePromotionCandidate(
                    promotion,
                    usage.UsedCountTotal,
                    calculation.DiscountAmount,
                    estimatedFinalTotal));
            }
            catch (OrderValidationException)
            {
                // A candidate can fail minimum-order or SKU-scope rules for this cart.
            }
        }

        return candidates
            .OrderByDescending(c => c.EstimatedDiscountAmount)
            .ThenBy(c => c.Promotion.ValidToUtc.HasValue ? 0 : 1)
            .ThenBy(c => c.Promotion.ValidToUtc ?? DateTime.MaxValue)
            .ThenBy(c => c.Promotion.PromoCode)
            .Select((c, index) => MapToLookupResponse(
                c.Promotion,
                c.UsedCountTotal,
                c.EstimatedDiscountAmount,
                c.EstimatedFinalTotal,
                c.EstimatedFinalTotal,
                index == 0))
            .ToList();
    }

    public async Task<PromotionResponse> CreateAsync(CreatePromotionRequest req, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var input = ValidatePromotionInput(
            req.PromoCode,
            req.DiscountType,
            req.DiscountValue,
            req.MaxDiscountAmount,
            req.MinimumOrderAmount,
            req.UsageLimitTotal,
            req.UsageLimitPerCustomer,
            req.ValidFromUtc ?? req.ValidFrom,
            req.ValidToUtc ?? req.ValidTo,
            req.IsActive,
            req.ScopeType,
            req.SkuIds,
            req.SkuScopes,
            req.CategoryIds,
            req.CategoryScopes,
            req.CustomerTierScopes,
            validateValidFromNotPast: true,
            validateValidToNotPast: true,
            nowUtc: now);

        var existing = await _promotionRepo.GetByNormalizedCodeAsync(input.NormalizedPromoCode, ct);
        if (existing is not null)
            throw new OrderValidationException("Mã giảm giá đã tồn tại.");

        var promotion = new Promotion
        {
            Id = Guid.NewGuid(),
            PromoCode = input.NormalizedPromoCode,
            NormalizedPromoCode = input.NormalizedPromoCode,
            DiscountType = input.DiscountType,
            DiscountValue = input.DiscountValue,
            MaxDiscountAmount = input.MaxDiscountAmount,
            MinimumOrderAmount = input.MinimumOrderAmount,
            UsageLimitTotal = input.UsageLimitTotal,
            UsageLimitPerCustomer = input.UsageLimitPerCustomer,
            ScopeType = input.ScopeType,
            ValidFromUtc = input.ValidFromUtc,
            ValidToUtc = input.ValidToUtc,
            IsActive = input.IsActive ?? true,
            CreatedAt = now,
            UpdatedAt = now
        };

        foreach (var scope in BuildPromotionScopes(
            promotion.Id,
            input.ScopeType,
            input.SkuScopes,
            input.CategoryScopes,
            now))
            promotion.Scopes.Add(scope);

        foreach (var scope in BuildPromotionCustomerTierScopes(promotion.Id, input.CustomerTierScopes, now))
            promotion.CustomerTierScopes.Add(scope);

        await _promotionRepo.AddAsync(promotion, ct);
        await _promotionRepo.SaveChangesAsync(ct);

        return MapToResponse(promotion, 0);
    }

    public async Task<PromotionResponse> UpdateAsync(
        Guid id, UpdatePromotionRequest req, CancellationToken ct = default)
    {
        var promotion = await _promotionRepo.GetByIdAsync(id, ct)
            ?? throw new PromotionNotFoundException(id);

        var now = DateTime.UtcNow;
        var requestedValidFromUtc = AsNullableUtc(req.ValidFromUtc ?? req.ValidFrom);
        var existingValidFromUtc = AsNullableUtc(promotion.ValidFromUtc);
        var validFromChanged = !SameNullableDateTimeMinute(requestedValidFromUtc, existingValidFromUtc);
        var requestedValidToUtc = AsNullableUtc(req.ValidToUtc ?? req.ValidTo);
        var existingValidToUtc = AsNullableUtc(promotion.ValidToUtc);
        var validToChanged = !SameNullableDateTimeMinute(requestedValidToUtc, existingValidToUtc);
        var requestedCustomerTierScopes = req.CustomerTierScopes ??
            promotion.CustomerTierScopes
                .Where(s => !s.IsDeleted)
                .Select(s => new PromotionCustomerTierScopeRequest(s.TierId, s.TierSnapshotName))
                .ToList();

        var input = ValidatePromotionInput(
            req.PromoCode,
            req.DiscountType,
            req.DiscountValue,
            req.MaxDiscountAmount,
            req.MinimumOrderAmount,
            req.UsageLimitTotal,
            req.UsageLimitPerCustomer,
            req.ValidFromUtc ?? req.ValidFrom,
            req.ValidToUtc ?? req.ValidTo,
            req.IsActive,
            req.ScopeType,
            req.SkuIds,
            req.SkuScopes,
            req.CategoryIds,
            req.CategoryScopes,
            requestedCustomerTierScopes,
            validateValidFromNotPast: validFromChanged,
            validateValidToNotPast: validToChanged,
            nowUtc: now);

        var orderCount = await _promotionRepo.CountOrdersUsingPromotionAsync(promotion.Id, ct);
        var changesImmutableFields =
            promotion.NormalizedPromoCode != input.NormalizedPromoCode ||
            promotion.DiscountType != input.DiscountType ||
            promotion.DiscountValue != input.DiscountValue ||
            promotion.MaxDiscountAmount != input.MaxDiscountAmount ||
            promotion.MinimumOrderAmount != input.MinimumOrderAmount ||
            promotion.UsageLimitTotal != input.UsageLimitTotal ||
            promotion.UsageLimitPerCustomer != input.UsageLimitPerCustomer ||
            promotion.ScopeType != input.ScopeType ||
            !SameSkuScopes(promotion.Scopes, input.SkuScopes) ||
            !SameCategoryScopes(promotion.Scopes, input.CategoryScopes) ||
            !SameCustomerTierScopes(promotion.CustomerTierScopes, input.CustomerTierScopes);

        if (orderCount > 0 && changesImmutableFields)
            throw new OrderValidationException(
                "Mã giảm giá đã được sử dụng nên không được đổi cấu hình giảm giá, phạm vi áp dụng, đơn tối thiểu, giới hạn lượt dùng hoặc hạng khách hàng áp dụng.");

        if (req.IsActive.HasValue &&
            req.IsActive.Value != promotion.IsActive &&
            IsExpired(promotion, now) &&
            IsExpired(input.ValidToUtc, now))
        {
            throw new OrderValidationException(
                "Mã giảm giá đã hết hạn. Vui lòng gia hạn thời gian sử dụng trước khi kích hoạt lại.");
        }

        if (promotion.NormalizedPromoCode != input.NormalizedPromoCode)
        {
            var existing = await _promotionRepo.GetByNormalizedCodeAsync(input.NormalizedPromoCode, ct);
            if (existing is not null && existing.Id != promotion.Id)
                throw new OrderValidationException("Mã giảm giá đã tồn tại.");
        }

        if (orderCount == 0)
        {
            promotion.PromoCode = input.NormalizedPromoCode;
            promotion.NormalizedPromoCode = input.NormalizedPromoCode;
            promotion.DiscountType = input.DiscountType;
            promotion.DiscountValue = input.DiscountValue;
            promotion.MaxDiscountAmount = input.MaxDiscountAmount;
            promotion.MinimumOrderAmount = input.MinimumOrderAmount;
            promotion.UsageLimitTotal = input.UsageLimitTotal;
            promotion.UsageLimitPerCustomer = input.UsageLimitPerCustomer;
            promotion.ScopeType = input.ScopeType;
            ReplaceScopes(promotion, input.SkuScopes, input.CategoryScopes, now);
            ReplaceCustomerTierScopes(promotion, input.CustomerTierScopes, now);
        }

        promotion.ValidFromUtc = input.ValidFromUtc;
        promotion.ValidToUtc = input.ValidToUtc;
        promotion.IsActive = input.IsActive ?? promotion.IsActive;
        promotion.UpdatedAt = now;

        await _promotionRepo.SaveChangesAsync(ct);
        return MapToResponse(promotion, orderCount);
    }

    public async Task<PromotionResponse> DeactivateAsync(Guid id, CancellationToken ct = default)
    {
        var promotion = await _promotionRepo.GetByIdAsync(id, ct)
            ?? throw new PromotionNotFoundException(id);

        EnsureNotExpiredForToggle(promotion, DateTime.UtcNow);
        promotion.IsActive = false;
        promotion.UpdatedAt = DateTime.UtcNow;

        await _promotionRepo.SaveChangesAsync(ct);
        var orderCount = await _promotionRepo.CountOrdersUsingPromotionAsync(promotion.Id, ct);
        return MapToResponse(promotion, orderCount);
    }

    public async Task<PromotionResponse> ReactivateAsync(Guid id, CancellationToken ct = default)
    {
        var promotion = await _promotionRepo.GetByIdAsync(id, ct)
            ?? throw new PromotionNotFoundException(id);

        EnsureNotExpiredForToggle(promotion, DateTime.UtcNow);
        promotion.IsActive = true;
        promotion.UpdatedAt = DateTime.UtcNow;

        await _promotionRepo.SaveChangesAsync(ct);
        var orderCount = await _promotionRepo.CountOrdersUsingPromotionAsync(promotion.Id, ct);
        return MapToResponse(promotion, orderCount);
    }

    public async Task<PromotionLookupResponse> LookupByCodeAsync(string? code, CancellationToken ct = default)
    {
        var normalizedCode = NormalizeLookupCode(code);
        var promotion = await _promotionRepo.GetActiveByNormalizedCodeAsync(normalizedCode, ct);

        if (promotion is null || !IsCurrentlyUsable(promotion, DateTime.UtcNow))
            throw new OrderValidationException(InvalidLookupMessage);

        var usedTotal = await _promotionRepo.CountOrdersUsingPromotionAsync(promotion.Id, ct);
        return MapToLookupResponse(promotion, usedTotal);
    }

    public async Task<PromotionApplyPreviewResponse> ApplyPreviewAsync(
        PromotionApplyPreviewRequest req, CancellationToken ct = default)
    {
        var items = ValidatePreviewItems(req.Items);
        var promotion = await ResolvePromotionAsync(req.PromotionId, req.PromotionCode, ct);
        var usage = await ValidateUsageLimitsAsync(promotion, req.CustomerId, ct);
        await ValidateCustomerTierEligibilityAsync(promotion, req.CustomerId, ct);
        var result = CalculatePromotionDiscount(promotion, items, req.ManualDiscount);

        return new PromotionApplyPreviewResponse(
            promotion.Id,
            promotion.PromoCode,
            promotion.DiscountType.ToString(),
            promotion.DiscountValue,
            promotion.MaxDiscountAmount,
            promotion.MinimumOrderAmount,
            promotion.UsageLimitTotal,
            promotion.UsageLimitPerCustomer,
            usage.UsedCountTotal,
            GetRemainingUsageTotal(promotion, usage.UsedCountTotal),
            promotion.ScopeType.ToString(),
            MapScopes(promotion),
            MapCategoryScopes(promotion),
            MapCustomerTierScopes(promotion),
            result.DiscountAmount,
            result.EligibleSubtotal,
            "Promotion applied successfully");
    }

    public async Task<PromotionDiscountResult> ValidateAndCalculateDiscountAsync(
        Guid? promotionId,
        string? promotionCode,
        IReadOnlyCollection<PromotionCalculationItem> items,
        decimal manualDiscount,
        Guid? customerId,
        CancellationToken ct = default)
    {
        var hasPromotionId = promotionId.HasValue && promotionId.Value != Guid.Empty;
        var hasPromotionCode = !string.IsNullOrWhiteSpace(promotionCode);

        if (!hasPromotionId && !hasPromotionCode)
            return PromotionDiscountResult.Empty;

        var promotion = await ResolvePromotionAsync(promotionId, promotionCode, ct);
        await ValidateUsageLimitsAsync(promotion, customerId, ct);
        await ValidateCustomerTierEligibilityAsync(promotion, customerId, ct);
        var result = CalculatePromotionDiscount(promotion, items, manualDiscount);
        return new PromotionDiscountResult(
            promotion.Id,
            promotion.PromoCode,
            result.DiscountAmount,
            result.EligibleSubtotal);
    }

    private static PromotionDiscountType? ParseAdminDiscountTypeFilter(string? discountType)
    {
        if (string.IsNullOrWhiteSpace(discountType) ||
            string.Equals(discountType.Trim(), "ALL", StringComparison.OrdinalIgnoreCase))
            return null;

        var normalizedType = discountType.Trim().ToUpperInvariant();
        return normalizedType is "PERCENTAGE" or "FIXED" &&
            Enum.TryParse<PromotionDiscountType>(normalizedType, out var parsed)
                ? parsed
                : null;
    }

    private static PromotionScopeType? ParseAdminScopeTypeFilter(string? scopeType)
    {
        if (string.IsNullOrWhiteSpace(scopeType) ||
            string.Equals(scopeType.Trim(), "ALL", StringComparison.OrdinalIgnoreCase))
            return null;

        var normalizedType = scopeType.Trim().ToUpperInvariant();
        return normalizedType is "ORDER" or "SKU" or "CATEGORY" &&
            Enum.TryParse<PromotionScopeType>(normalizedType, out var parsed)
                ? parsed
                : null;
    }

    private static PromotionEffectiveStatus? ParseAdminStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status) ||
            string.Equals(status.Trim(), "ALL", StringComparison.OrdinalIgnoreCase))
            return null;

        return status.Trim().ToUpperInvariant() switch
        {
            "ACTIVE" => PromotionEffectiveStatus.ACTIVE,
            "INACTIVE" => PromotionEffectiveStatus.INACTIVE,
            "DEACTIVATED" => PromotionEffectiveStatus.INACTIVE,
            "SCHEDULED" => PromotionEffectiveStatus.SCHEDULED,
            "NOT_STARTED" => PromotionEffectiveStatus.SCHEDULED,
            "EXPIRED" => PromotionEffectiveStatus.EXPIRED,
            _ => null
        };
    }

    private async Task<Promotion> ResolvePromotionAsync(
        Guid? promotionId, string? promotionCode, CancellationToken ct)
    {
        Promotion? promotion;
        if (promotionId.HasValue && promotionId.Value != Guid.Empty)
        {
            promotion = await _promotionRepo.GetByIdAsync(promotionId.Value, ct);
        }
        else
        {
            var normalizedCode = NormalizeLookupCode(promotionCode);
            promotion = await _promotionRepo.GetActiveByNormalizedCodeAsync(normalizedCode, ct);
        }

        if (promotion is null || !IsCurrentlyUsable(promotion, DateTime.UtcNow))
            throw new OrderValidationException(InvalidLookupMessage);

        return promotion;
    }

    private static PromotionCalculationResult CalculatePromotionDiscount(
        Promotion promotion,
        IReadOnlyCollection<PromotionCalculationItem> items,
        decimal manualDiscount)
    {
        if (manualDiscount > 0)
            throw new OrderValidationException(
                "Không thể áp dụng đồng thời mã khuyến mãi và giảm giá thủ công.");

        var itemList = items.ToList();
        var totalAmount = itemList.Sum(i => i.SubTotal);
        var baseAfterManualDiscount = totalAmount;

        if (promotion.MinimumOrderAmount > 0 &&
            baseAfterManualDiscount < promotion.MinimumOrderAmount)
            throw new OrderValidationException(
                $"Đơn hàng cần tối thiểu {FormatVietnamAmount(promotion.MinimumOrderAmount)}đ để áp dụng mã {promotion.PromoCode}.");

        var eligibleSubtotal = promotion.ScopeType switch
        {
            PromotionScopeType.SKU => GetEligibleSkuSubtotal(promotion, itemList),
            PromotionScopeType.CATEGORY => GetEligibleCategorySubtotal(promotion, itemList),
            _ => totalAmount
        };

        if (promotion.ScopeType == PromotionScopeType.SKU && eligibleSubtotal <= 0)
            throw new OrderValidationException(NotApplicableMessage);
        if (promotion.ScopeType == PromotionScopeType.CATEGORY && eligibleSubtotal <= 0)
            throw new OrderValidationException(CategoryNotApplicableMessage);

        var discountBase = promotion.ScopeType is PromotionScopeType.SKU or PromotionScopeType.CATEGORY
            ? Math.Min(eligibleSubtotal, baseAfterManualDiscount)
            : baseAfterManualDiscount;

        var discountAmount = CalculateDiscount(promotion, discountBase);
        return new PromotionCalculationResult(discountAmount, eligibleSubtotal);
    }

    private static decimal GetEligibleSkuSubtotal(
        Promotion promotion, IReadOnlyCollection<PromotionCalculationItem> items)
    {
        var eligibleSkuIds = promotion.Scopes
            .Where(s => s.ScopeType == PromotionScopeType.SKU && s.SkuId.HasValue)
            .Select(s => s.SkuId!.Value)
            .ToHashSet();

        if (eligibleSkuIds.Count == 0)
            return 0;

        return items
            .Where(i => eligibleSkuIds.Contains(i.SkuId))
            .Sum(i => i.SubTotal);
    }

    private static decimal GetEligibleCategorySubtotal(
        Promotion promotion, IReadOnlyCollection<PromotionCalculationItem> items)
    {
        var eligibleCategoryIds = promotion.Scopes
            .Where(s => s.ScopeType == PromotionScopeType.CATEGORY && s.CategoryId.HasValue)
            .Select(s => s.CategoryId!.Value)
            .ToHashSet();

        if (eligibleCategoryIds.Count == 0)
            return 0;

        return items
            .Where(i => i.CategoryId.HasValue && eligibleCategoryIds.Contains(i.CategoryId.Value))
            .Sum(i => i.SubTotal);
    }

    private static List<PromotionCalculationItem> ValidatePreviewItems(
        List<PromotionApplyPreviewItemRequest>? items)
    {
        var errors = new List<string>();
        if (items is null || items.Count == 0)
            errors.Add("Đơn hàng phải có ít nhất 1 sản phẩm.");

        var result = new List<PromotionCalculationItem>();
        if (items is not null)
        {
            for (var i = 0; i < items.Count; i++)
            {
                var item = items[i];
                if (item.SkuId == Guid.Empty)
                    errors.Add($"Sản phẩm [{i + 1}]: SkuId không hợp lệ.");
                if (item.Quantity < 1)
                    errors.Add($"Sản phẩm [{i + 1}]: Số lượng phải >= 1.");
                if (item.UnitPrice < 0)
                    errors.Add($"Sản phẩm [{i + 1}]: Đơn giá không được âm.");

                var subTotal = item.SubTotal ?? item.UnitPrice * item.Quantity;
                if (subTotal < 0)
                    errors.Add($"Sản phẩm [{i + 1}]: Thành tiền không được âm.");

                result.Add(new PromotionCalculationItem(
                    item.SkuId,
                    item.Quantity,
                    item.UnitPrice,
                    subTotal,
                    item.CategoryId));
            }
        }

        if (errors.Count > 0)
            throw new OrderValidationException(errors);

        return result;
    }

    private static PromotionInput ValidatePromotionInput(
        string? promoCode,
        string? discountType,
        decimal discountValue,
        decimal? maxDiscountAmount,
        decimal? minimumOrderAmount,
        int? usageLimitTotal,
        int? usageLimitPerCustomer,
        DateTime? validFrom,
        DateTime? validTo,
        bool? isActive,
        string? scopeType,
        List<Guid>? skuIds,
        List<PromotionSkuScopeRequest>? skuScopes,
        List<int>? categoryIds,
        List<PromotionCategoryScopeRequest>? categoryScopes,
        List<PromotionCustomerTierScopeRequest>? customerTierScopes,
        bool validateValidFromNotPast,
        bool validateValidToNotPast,
        DateTime nowUtc)
    {
        var errors = new List<string>();
        var normalizedCode = NormalizePromoCode(promoCode, errors);
        var parsedDiscountType = ParseDiscountType(discountType, errors);
        var parsedScopeType = ParseScopeType(scopeType, errors);
        var normalizedMinimumOrderAmount = minimumOrderAmount ?? 0m;
        var normalizedUsageLimitTotal = NormalizeUsageLimit(
            usageLimitTotal,
            "Tổng lượt sử dụng không hợp lệ.",
            errors);
        var normalizedUsageLimitPerCustomer = NormalizeUsageLimit(
            usageLimitPerCustomer,
            "Giới hạn mỗi khách không hợp lệ.",
            errors);
        decimal? normalizedMaxDiscountAmount = null;

        if (discountValue <= 0)
            errors.Add("Giá trị giảm phải lớn hơn 0.");
        if (normalizedMinimumOrderAmount < 0)
            errors.Add("Đơn tối thiểu không được âm.");
        if (normalizedMinimumOrderAmount > MaxMinimumOrderAmount)
            errors.Add("Đơn tối thiểu không được vượt quá 100.000.000đ.");

        if (parsedDiscountType == PromotionDiscountType.PERCENTAGE &&
            discountValue > MaxPercentageDiscountValue)
            errors.Add("Mã giảm phần trăm không được vượt quá 90%.");

        if (parsedDiscountType == PromotionDiscountType.PERCENTAGE)
        {
            if (!maxDiscountAmount.HasValue || maxDiscountAmount.Value <= 0)
                errors.Add("Mã giảm phần trăm cần có số tiền giảm tối đa.");
            else if (maxDiscountAmount.Value > MaxPercentageDiscountAmount)
                errors.Add("Số tiền giảm tối đa không được vượt quá 10.000.000đ.");
            else
                normalizedMaxDiscountAmount = maxDiscountAmount.Value;
        }

        if (parsedDiscountType == PromotionDiscountType.FIXED &&
            discountValue > MaxFixedDiscountValue)
            errors.Add("Mã giảm cố định không được vượt quá 10.000.000đ.");

        if (parsedDiscountType == PromotionDiscountType.FIXED &&
            normalizedMinimumOrderAmount <= 0)
            errors.Add("Mã giảm cố định cần có đơn tối thiểu lớn hơn 0đ.");

        if (parsedDiscountType == PromotionDiscountType.FIXED &&
            normalizedMinimumOrderAmount > 0 &&
            discountValue > normalizedMinimumOrderAmount)
            errors.Add("Số tiền giảm cố định không được lớn hơn đơn tối thiểu.");

        if (normalizedUsageLimitTotal.HasValue &&
            normalizedUsageLimitPerCustomer.HasValue &&
            normalizedUsageLimitPerCustomer.Value > normalizedUsageLimitTotal.Value)
            errors.Add("Giới hạn mỗi khách không được lớn hơn tổng lượt sử dụng.");

        var validFromUtc = NormalizeValidFromUtc(
            AsNullableUtc(validFrom),
            validateValidFromNotPast,
            nowUtc,
            errors);
        var validToUtc = AsNullableUtc(validTo);
        if (validateValidToNotPast && validToUtc.HasValue && validToUtc.Value < nowUtc)
            errors.Add("Thời gian kết thúc không được ở quá khứ.");
        if (validFromUtc.HasValue && validToUtc.HasValue && validToUtc.Value <= validFromUtc.Value)
            errors.Add("Thời gian kết thúc phải sau thời gian bắt đầu.");

        var normalizedSkuScopes = NormalizeSkuScopes(parsedScopeType, skuIds, skuScopes, errors);
        var normalizedCategoryScopes = NormalizeCategoryScopes(
            parsedScopeType,
            categoryIds,
            categoryScopes,
            errors);
        var normalizedCustomerTierScopes = NormalizeCustomerTierScopes(customerTierScopes, errors);

        if (errors.Count > 0)
            throw new OrderValidationException(errors);

        return new PromotionInput(
            normalizedCode!,
            parsedDiscountType!.Value,
            discountValue,
            normalizedMaxDiscountAmount,
            normalizedMinimumOrderAmount,
            normalizedUsageLimitTotal,
            normalizedUsageLimitPerCustomer,
            validFromUtc,
            validToUtc,
            isActive,
            parsedScopeType,
            normalizedSkuScopes,
            normalizedCategoryScopes,
            normalizedCustomerTierScopes);
    }

    private static PromotionScopeType ParseScopeType(string? scopeType, List<string> errors)
    {
        if (string.IsNullOrWhiteSpace(scopeType))
            return PromotionScopeType.ORDER;

        var normalizedType = scopeType.Trim().ToUpperInvariant();
        if (normalizedType is "ORDER" or "SKU" or "CATEGORY" &&
            Enum.TryParse<PromotionScopeType>(normalizedType, out var parsed))
            return parsed;

        errors.Add("Phạm vi áp dụng chỉ hỗ trợ ORDER, SKU hoặc CATEGORY.");
        return PromotionScopeType.ORDER;
    }

    private static List<PromotionScopeInput> NormalizeSkuScopes(
        PromotionScopeType scopeType,
        List<Guid>? skuIds,
        List<PromotionSkuScopeRequest>? skuScopes,
        List<string> errors)
    {
        if (scopeType != PromotionScopeType.SKU)
            return [];

        var bySkuId = new Dictionary<Guid, PromotionScopeInput>();
        foreach (var scope in skuScopes ?? [])
        {
            if (scope.SkuId == Guid.Empty)
                continue;

            bySkuId[scope.SkuId] = new PromotionScopeInput(
                scope.SkuId,
                string.IsNullOrWhiteSpace(scope.SkuCode) ? null : scope.SkuCode.Trim(),
                string.IsNullOrWhiteSpace(scope.SkuName) ? null : scope.SkuName.Trim());
        }

        foreach (var skuId in skuIds ?? [])
        {
            if (skuId == Guid.Empty)
                continue;

            bySkuId.TryAdd(skuId, new PromotionScopeInput(skuId, null, null));
        }

        if (bySkuId.Count == 0)
            errors.Add("Vui lòng chọn ít nhất một sản phẩm áp dụng.");

        return bySkuId.Values.ToList();
    }

    private static List<PromotionCategoryScopeInput> NormalizeCategoryScopes(
        PromotionScopeType scopeType,
        List<int>? categoryIds,
        List<PromotionCategoryScopeRequest>? categoryScopes,
        List<string> errors)
    {
        if (scopeType != PromotionScopeType.CATEGORY)
            return [];

        var byCategoryId = new Dictionary<int, PromotionCategoryScopeInput>();
        foreach (var scope in categoryScopes ?? [])
        {
            if (scope.CategoryId <= 0)
            {
                errors.Add("Danh mục áp dụng không hợp lệ.");
                continue;
            }

            byCategoryId[scope.CategoryId] = new PromotionCategoryScopeInput(
                scope.CategoryId,
                string.IsNullOrWhiteSpace(scope.CategoryName) ? null : scope.CategoryName.Trim());
        }

        foreach (var categoryId in categoryIds ?? [])
        {
            if (categoryId <= 0)
            {
                errors.Add("Danh mục áp dụng không hợp lệ.");
                continue;
            }

            byCategoryId.TryAdd(categoryId, new PromotionCategoryScopeInput(categoryId, null));
        }

        if (byCategoryId.Count == 0)
            errors.Add("Vui lòng chọn ít nhất một danh mục áp dụng mã giảm giá.");

        return byCategoryId.Values.ToList();
    }

    private static List<PromotionCustomerTierScopeInput> NormalizeCustomerTierScopes(
        List<PromotionCustomerTierScopeRequest>? customerTierScopes,
        List<string> errors)
    {
        var byTierId = new Dictionary<int, PromotionCustomerTierScopeInput>();
        foreach (var scope in customerTierScopes ?? [])
        {
            if (scope.TierId <= 0)
            {
                errors.Add("Hạng khách hàng áp dụng không hợp lệ.");
                continue;
            }

            byTierId[scope.TierId] = new PromotionCustomerTierScopeInput(
                scope.TierId,
                string.IsNullOrWhiteSpace(scope.TierName) ? null : scope.TierName.Trim());
        }

        return byTierId.Values.ToList();
    }

    private static string? NormalizePromoCode(string? promoCode, List<string> errors)
    {
        if (string.IsNullOrWhiteSpace(promoCode))
        {
            errors.Add("Mã giảm giá là bắt buộc.");
            return null;
        }

        var normalizedCode = promoCode.Trim().ToUpperInvariant();
        if (normalizedCode.Length is < 3 or > 50)
            errors.Add("Mã giảm giá phải có từ 3 đến 50 ký tự.");
        if (!PromoCodeRegex.IsMatch(normalizedCode))
            errors.Add("Mã giảm giá chỉ được chứa chữ cái, số, dấu gạch ngang (-) hoặc gạch dưới (_).");

        return normalizedCode;
    }

    private static string NormalizeLookupCode(string? promoCode)
    {
        if (string.IsNullOrWhiteSpace(promoCode))
            throw new OrderValidationException(InvalidLookupMessage);

        var normalizedCode = promoCode.Trim().ToUpperInvariant();
        if (normalizedCode.Length is < 3 or > 50 || !PromoCodeRegex.IsMatch(normalizedCode))
            throw new OrderValidationException(InvalidLookupMessage);

        return normalizedCode;
    }

    private static PromotionDiscountType? ParseDiscountType(string? discountType, List<string> errors)
    {
        if (string.IsNullOrWhiteSpace(discountType))
        {
            errors.Add("Loại giảm giá là bắt buộc.");
            return null;
        }

        var normalizedType = discountType.Trim().ToUpperInvariant();
        if (normalizedType is "PERCENTAGE" or "FIXED" &&
            Enum.TryParse<PromotionDiscountType>(normalizedType, out var parsed))
            return parsed;

        errors.Add("Loại giảm giá chỉ hỗ trợ PERCENTAGE hoặc FIXED.");
        return null;
    }

    private static int? NormalizeUsageLimit(int? value, string message, List<string> errors)
    {
        if (!value.HasValue || value.Value == 0)
            return null;

        if (value.Value < 0 || value.Value > MaxUsageLimit)
        {
            errors.Add(message);
            return null;
        }

        return value.Value;
    }

    private static decimal CalculateDiscount(Promotion promotion, decimal baseForPromotion)
    {
        if (baseForPromotion <= 0)
            return 0;

        if (promotion.DiscountType == PromotionDiscountType.FIXED)
            return Math.Min(promotion.DiscountValue, baseForPromotion);

        if (promotion.DiscountType == PromotionDiscountType.PERCENTAGE &&
            promotion.MaxDiscountAmount.HasValue)
        {
            var raw = baseForPromotion * promotion.DiscountValue / 100m;
            var capped = Math.Min(raw, promotion.MaxDiscountAmount.Value);
            var rounded = RoundToNearestThousand(capped);
            var final = Math.Min(rounded, promotion.MaxDiscountAmount.Value);
            return Math.Min(final, baseForPromotion);
        }

        return 0;
    }

    private static decimal RoundToNearestThousand(decimal value) =>
        Math.Round(value / 1000m, 0, MidpointRounding.AwayFromZero) * 1000m;

    private static string FormatVietnamAmount(decimal amount)
    {
        var rounded = Math.Round(amount, 0, MidpointRounding.AwayFromZero);
        return string
            .Format(System.Globalization.CultureInfo.InvariantCulture, "{0:N0}", rounded)
            .Replace(",", ".");
    }

    private static bool IsCurrentlyUsable(Promotion promotion, DateTime nowUtc)
    {
        if (promotion.IsDeleted || !promotion.IsActive)
            return false;
        if (promotion.ValidFromUtc.HasValue && AsUtc(promotion.ValidFromUtc.Value) > nowUtc)
            return false;
        if (IsExpired(promotion, nowUtc))
            return false;

        return true;
    }

    private static bool IsExpired(Promotion promotion, DateTime nowUtc) =>
        IsExpired(promotion.ValidToUtc, nowUtc);

    private static bool IsExpired(DateTime? validToUtc, DateTime nowUtc) =>
        validToUtc.HasValue && AsUtc(validToUtc.Value) <= nowUtc;

    private static void EnsureNotExpiredForToggle(Promotion promotion, DateTime nowUtc)
    {
        if (IsExpired(promotion, nowUtc))
            throw new OrderValidationException(
                "Mã giảm giá đã hết hạn. Vui lòng gia hạn thời gian sử dụng trước khi kích hoạt lại.");
    }

    private async Task<PromotionUsageSnapshot> ValidateUsageLimitsAsync(
        Promotion promotion,
        Guid? customerId,
        CancellationToken ct)
    {
        var usedTotal = await _promotionRepo.CountOrdersUsingPromotionAsync(promotion.Id, ct);
        var totalLimit = NormalizeConfiguredUsageLimit(promotion.UsageLimitTotal);
        if (totalLimit.HasValue && usedTotal >= totalLimit.Value)
            throw new OrderValidationException("Mã giảm giá đã hết lượt sử dụng.");

        var perCustomerLimit = NormalizeConfiguredUsageLimit(promotion.UsageLimitPerCustomer);
        if (perCustomerLimit.HasValue && customerId.HasValue && customerId.Value != Guid.Empty)
        {
            var usedByCustomer = await _promotionRepo.CountOrdersUsingPromotionByCustomerAsync(
                promotion.Id,
                customerId.Value,
                ct);

            if (usedByCustomer >= perCustomerLimit.Value)
                throw new OrderValidationException("Khách hàng đã sử dụng hết lượt cho mã giảm giá này.");
        }

        return new PromotionUsageSnapshot(usedTotal);
    }

    private async Task ValidateCustomerTierEligibilityAsync(
        Promotion promotion,
        Guid? customerId,
        CancellationToken ct)
    {
        var tierScopes = promotion.CustomerTierScopes
            .Where(s => !s.IsDeleted)
            .ToList();
        if (tierScopes.Count == 0)
            return;

        if (!customerId.HasValue || customerId.Value == Guid.Empty)
            throw new OrderValidationException(CustomerTierRequiredMessage);

        var customer = await _customerCatalogClient.GetCustomerAsync(customerId.Value, ct);
        if (customer is null)
            throw new OrderValidationException(CustomerNotFoundMessage);

        if (!customer.TierId.HasValue)
            throw new OrderValidationException(CustomerTierNotApplicableMessage);

        var eligibleTierIds = tierScopes.Select(s => s.TierId).ToHashSet();
        if (!eligibleTierIds.Contains(customer.TierId.Value))
            throw new OrderValidationException(CustomerTierNotApplicableMessage);
    }

    private static int? NormalizeConfiguredUsageLimit(int? value) =>
        value.HasValue && value.Value > 0 ? value.Value : null;

    private static int? GetRemainingUsageTotal(Promotion promotion, int usedTotal)
    {
        var totalLimit = NormalizeConfiguredUsageLimit(promotion.UsageLimitTotal);
        return totalLimit.HasValue
            ? Math.Max(0, totalLimit.Value - usedTotal)
            : null;
    }

    private static string GetValidityStatus(Promotion promotion, DateTime nowUtc)
    {
        if (IsExpired(promotion, nowUtc))
            return PromotionEffectiveStatus.EXPIRED.ToString();
        if (!promotion.IsActive)
            return PromotionEffectiveStatus.INACTIVE.ToString();
        if (promotion.ValidFromUtc.HasValue && AsUtc(promotion.ValidFromUtc.Value) > nowUtc)
            return PromotionEffectiveStatus.SCHEDULED.ToString();

        return PromotionEffectiveStatus.ACTIVE.ToString();
    }

    private static List<PromotionScope> BuildPromotionScopes(
        Guid promotionId,
        PromotionScopeType scopeType,
        List<PromotionScopeInput> skuScopes,
        List<PromotionCategoryScopeInput> categoryScopes,
        DateTime now)
    {
        if (scopeType == PromotionScopeType.ORDER)
            return [];

        if (scopeType == PromotionScopeType.SKU)
        {
            return skuScopes.Select(scope => new PromotionScope
            {
                Id = Guid.NewGuid(),
                PromotionId = promotionId,
                ScopeType = PromotionScopeType.SKU,
                SkuId = scope.SkuId,
                SkuCode = scope.SkuCode,
                SkuSnapshotName = scope.SkuName,
                CreatedAt = now,
                UpdatedAt = now
            }).ToList();
        }

        return categoryScopes.Select(scope => new PromotionScope
        {
            Id = Guid.NewGuid(),
            PromotionId = promotionId,
            ScopeType = PromotionScopeType.CATEGORY,
            CategoryId = scope.CategoryId,
            CategorySnapshotName = scope.CategoryName,
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();
    }

    private static void ReplaceScopes(
        Promotion promotion,
        List<PromotionScopeInput> nextSkuScopes,
        List<PromotionCategoryScopeInput> nextCategoryScopes,
        DateTime now)
    {
        foreach (var scope in promotion.Scopes)
        {
            scope.IsDeleted = true;
            scope.UpdatedAt = now;
        }

        foreach (var scope in BuildPromotionScopes(
            promotion.Id,
            promotion.ScopeType,
            nextSkuScopes,
            nextCategoryScopes,
            now))
            promotion.Scopes.Add(scope);
    }

    private static List<PromotionCustomerTierScope> BuildPromotionCustomerTierScopes(
        Guid promotionId,
        List<PromotionCustomerTierScopeInput> customerTierScopes,
        DateTime now) =>
        customerTierScopes.Select(scope => new PromotionCustomerTierScope
        {
            Id = Guid.NewGuid(),
            PromotionId = promotionId,
            TierId = scope.TierId,
            TierSnapshotName = scope.TierName,
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();

    private static void ReplaceCustomerTierScopes(
        Promotion promotion,
        List<PromotionCustomerTierScopeInput> nextCustomerTierScopes,
        DateTime now)
    {
        foreach (var scope in promotion.CustomerTierScopes)
        {
            scope.IsDeleted = true;
            scope.UpdatedAt = now;
        }

        foreach (var scope in BuildPromotionCustomerTierScopes(
            promotion.Id,
            nextCustomerTierScopes,
            now))
            promotion.CustomerTierScopes.Add(scope);
    }

    private static bool SameSkuScopes(
        ICollection<PromotionScope> existingScopes,
        List<PromotionScopeInput> nextScopes)
    {
        var existingIds = existingScopes
            .Where(s => s.ScopeType == PromotionScopeType.SKU && s.SkuId.HasValue)
            .Select(s => s.SkuId!.Value)
            .OrderBy(id => id)
            .ToArray();

        var nextIds = nextScopes
            .Select(s => s.SkuId)
            .OrderBy(id => id)
            .ToArray();

        return existingIds.SequenceEqual(nextIds);
    }

    private static bool SameCategoryScopes(
        ICollection<PromotionScope> existingScopes,
        List<PromotionCategoryScopeInput> nextScopes)
    {
        var existingIds = existingScopes
            .Where(s => s.ScopeType == PromotionScopeType.CATEGORY && s.CategoryId.HasValue)
            .Select(s => s.CategoryId!.Value)
            .OrderBy(id => id)
            .ToArray();

        var nextIds = nextScopes
            .Select(s => s.CategoryId)
            .OrderBy(id => id)
            .ToArray();

        return existingIds.SequenceEqual(nextIds);
    }

    private static bool SameCustomerTierScopes(
        ICollection<PromotionCustomerTierScope> existingScopes,
        List<PromotionCustomerTierScopeInput> nextScopes)
    {
        var existingIds = existingScopes
            .Where(s => !s.IsDeleted)
            .Select(s => s.TierId)
            .OrderBy(id => id)
            .ToArray();

        var nextIds = nextScopes
            .Select(s => s.TierId)
            .OrderBy(id => id)
            .ToArray();

        return existingIds.SequenceEqual(nextIds);
    }

    private static PromotionResponse MapToResponse(Promotion promotion, int orderCount)
    {
        var status = GetValidityStatus(promotion, DateTime.UtcNow);
        return new PromotionResponse(
            promotion.Id,
            promotion.PromoCode,
            promotion.DiscountType.ToString(),
            promotion.DiscountValue,
            promotion.MaxDiscountAmount,
            promotion.MinimumOrderAmount,
            promotion.UsageLimitTotal,
            promotion.UsageLimitPerCustomer,
            orderCount,
            GetRemainingUsageTotal(promotion, orderCount),
            AsNullableUtc(promotion.ValidFromUtc),
            AsNullableUtc(promotion.ValidToUtc),
            status,
            promotion.IsActive,
            status == PromotionEffectiveStatus.ACTIVE.ToString(),
            status != PromotionEffectiveStatus.EXPIRED.ToString(),
            promotion.ScopeType.ToString(),
            MapScopes(promotion),
            MapCategoryScopes(promotion),
            MapCustomerTierScopes(promotion),
            orderCount);
    }

    private static PromotionLookupResponse MapToLookupResponse(
        Promotion promotion,
        int usedCountTotal = 0,
        decimal? estimatedDiscountAmount = null,
        decimal? estimatedFinalTotal = null,
        decimal? estimatedPayableAmount = null,
        bool isBestSuggestion = false)
    {
        var status = GetValidityStatus(promotion, DateTime.UtcNow);
        return new PromotionLookupResponse(
            promotion.Id,
            promotion.PromoCode,
            promotion.DiscountType.ToString(),
            promotion.DiscountValue,
            promotion.MaxDiscountAmount,
            promotion.MinimumOrderAmount,
            promotion.UsageLimitTotal,
            promotion.UsageLimitPerCustomer,
            usedCountTotal,
            GetRemainingUsageTotal(promotion, usedCountTotal),
            AsNullableUtc(promotion.ValidFromUtc),
            AsNullableUtc(promotion.ValidToUtc),
            status,
            promotion.IsActive,
            status == PromotionEffectiveStatus.ACTIVE.ToString(),
            status != PromotionEffectiveStatus.EXPIRED.ToString(),
            promotion.ScopeType.ToString(),
            MapScopes(promotion),
            MapCategoryScopes(promotion),
            MapCustomerTierScopes(promotion),
            estimatedDiscountAmount,
            estimatedFinalTotal,
            estimatedPayableAmount,
            isBestSuggestion);
    }

    private static List<PromotionScopeResponse> MapScopes(Promotion promotion) =>
        promotion.ScopeType == PromotionScopeType.SKU
            ? promotion.Scopes
                .Where(s => s.ScopeType == PromotionScopeType.SKU && s.SkuId.HasValue)
                .Select(s => new PromotionScopeResponse(
                    s.SkuId!.Value,
                    s.SkuCode,
                    s.SkuSnapshotName))
                .ToList()
            : [];

    private static List<PromotionCategoryScopeResponse> MapCategoryScopes(Promotion promotion) =>
        promotion.ScopeType == PromotionScopeType.CATEGORY
            ? promotion.Scopes
                .Where(s => s.ScopeType == PromotionScopeType.CATEGORY && s.CategoryId.HasValue)
                .Select(s => new PromotionCategoryScopeResponse(
                    s.CategoryId!.Value,
                    s.CategorySnapshotName))
                .ToList()
            : [];

    private static List<PromotionCustomerTierScopeResponse> MapCustomerTierScopes(Promotion promotion) =>
        promotion.CustomerTierScopes
            .Where(s => !s.IsDeleted)
            .Select(s => new PromotionCustomerTierScopeResponse(
                s.TierId,
                s.TierSnapshotName,
                s.TierSnapshotName))
            .ToList();

    private static DateTime? NormalizeValidFromUtc(
        DateTime? validFromUtc,
        bool validateValidFromNotPast,
        DateTime nowUtc,
        List<string> errors)
    {
        if (!validFromUtc.HasValue || !validateValidFromNotPast)
            return validFromUtc;

        var value = validFromUtc.Value;
        if (value >= nowUtc)
            return value;

        if (nowUtc - value <= ValidFromPastTolerance)
            return nowUtc;

        errors.Add("Thời gian bắt đầu không được ở quá khứ.");
        return value;
    }

    private static bool SameNullableDateTimeMinute(DateTime? left, DateTime? right)
    {
        if (!left.HasValue && !right.HasValue)
            return true;
        if (!left.HasValue || !right.HasValue)
            return false;

        return TruncateToMinute(left.Value) == TruncateToMinute(right.Value);
    }

    private static DateTime TruncateToMinute(DateTime dateTime)
    {
        var utc = AsUtc(dateTime);
        return new DateTime(
            utc.Year,
            utc.Month,
            utc.Day,
            utc.Hour,
            utc.Minute,
            0,
            DateTimeKind.Utc);
    }

    private static DateTime? AsNullableUtc(DateTime? dateTime) =>
        dateTime.HasValue ? AsUtc(dateTime.Value) : null;

    private static DateTime AsUtc(DateTime dateTime) =>
        dateTime.Kind == DateTimeKind.Utc
            ? dateTime
            : DateTime.SpecifyKind(dateTime, DateTimeKind.Utc);

    private record PromotionInput(
        string NormalizedPromoCode,
        PromotionDiscountType DiscountType,
        decimal DiscountValue,
        decimal? MaxDiscountAmount,
        decimal MinimumOrderAmount,
        int? UsageLimitTotal,
        int? UsageLimitPerCustomer,
        DateTime? ValidFromUtc,
        DateTime? ValidToUtc,
        bool? IsActive,
        PromotionScopeType ScopeType,
        List<PromotionScopeInput> SkuScopes,
        List<PromotionCategoryScopeInput> CategoryScopes,
        List<PromotionCustomerTierScopeInput> CustomerTierScopes);

    private record PromotionScopeInput(
        Guid SkuId,
        string? SkuCode,
        string? SkuName);

    private record PromotionCategoryScopeInput(
        int CategoryId,
        string? CategoryName);

    private record PromotionCustomerTierScopeInput(
        int TierId,
        string? TierName);

    private record PromotionCalculationResult(
        decimal DiscountAmount,
        decimal EligibleSubtotal);

    private record PromotionUsageSnapshot(int UsedCountTotal);

    private record ApplicablePromotionCandidate(
        Promotion Promotion,
        int UsedCountTotal,
        decimal EstimatedDiscountAmount,
        decimal EstimatedFinalTotal);
}

public record PromotionCalculationItem(
    Guid SkuId,
    int Quantity,
    decimal UnitPrice,
    decimal SubTotal,
    int? CategoryId = null);

public record PromotionDiscountResult(
    Guid? PromotionId,
    string? PromotionCode,
    decimal DiscountAmount,
    decimal EligibleSubtotal)
{
    public static PromotionDiscountResult Empty { get; } = new(null, null, 0, 0);
}
