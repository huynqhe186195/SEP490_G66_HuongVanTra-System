using System.Text.RegularExpressions;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.UseCases;

public class PromotionLogic(IPromotionRepository _promotionRepo)
{
    private const decimal MaxPercentageDiscountValue = 90m;
    private const decimal MaxFixedDiscountValue = 10_000_000m;
    private const decimal MaxPercentageDiscountAmount = 10_000_000m;
    private const int MaxUsageLimit = 1_000_000;
    private const int AdminPromotionPageSize = 10;
    private const string InvalidLookupMessage = "M├ú giß║úm gi├í kh├┤ng hß╗úp lß╗ç hoß║Àc ─æ├ú hß║┐t hiß╗çu lß╗▒c.";
    private const string NotApplicableMessage = "Promotion is not applicable to selected items.";
    private const string CategoryNotApplicableMessage = "Mã giảm giá không áp dụng cho danh mục trong đơn hàng.";
    private static readonly TimeSpan ValidFromPastTolerance = TimeSpan.FromMinutes(2);
    private static readonly Regex PromoCodeRegex = new("^[A-Z0-9_-]+$", RegexOptions.Compiled);

    public async Task<PagedResponse<PromotionResponse>> GetAdminPromotionsAsync(
        GetAdminPromotionsRequest req, CancellationToken ct = default)
    {
        var page = req.Page < 1 ? 1 : req.Page;
        var pageSize = AdminPromotionPageSize;
        var discountType = ParseAdminDiscountTypeFilter(req.DiscountType);
        var scopeType = ParseAdminScopeTypeFilter(req.ScopeType);
        var isActive = ParseAdminStatusFilter(req.Status);

        var (promotions, totalCount) = await _promotionRepo.GetPagedAsync(
            req.Search,
            discountType,
            scopeType,
            isActive,
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
        var result = new List<PromotionLookupResponse>();

        foreach (var promotion in promotions)
        {
            try
            {
                var usage = await ValidateUsageLimitsAsync(promotion, req.CustomerId, ct);
                _ = CalculatePromotionDiscount(promotion, items, req.ManualDiscount);
                result.Add(MapToLookupResponse(promotion, usage.UsedCountTotal));
            }
            catch (OrderValidationException)
            {
                // A candidate can fail minimum-order or SKU-scope rules for this cart.
            }
        }

        return result;
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
            validateValidFromNotPast: true,
            nowUtc: now);

        var existing = await _promotionRepo.GetByNormalizedCodeAsync(input.NormalizedPromoCode, ct);
        if (existing is not null)
            throw new OrderValidationException("M├ú giß║úm gi├í ─æ├ú tß╗ôn tß║íi.");

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
            validateValidFromNotPast: validFromChanged,
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
            !SameCategoryScopes(promotion.Scopes, input.CategoryScopes);

        if (orderCount > 0 && changesImmutableFields)
            throw new OrderValidationException(
                "M├ú giß║úm gi├í ─æ├ú ─æã░ß╗úc sß╗¡ dß╗Ñng n├¬n kh├┤ng ─æã░ß╗úc ─æß╗òi cß║Ñu h├¼nh giß║úm gi├í, phß║ím vi ├íp dß╗Ñng, ─æãín tß╗æi thiß╗âu hoß║Àc giß╗øi hß║ín lã░ß╗út d├╣ng.");

        if (promotion.NormalizedPromoCode != input.NormalizedPromoCode)
        {
            var existing = await _promotionRepo.GetByNormalizedCodeAsync(input.NormalizedPromoCode, ct);
            if (existing is not null && existing.Id != promotion.Id)
                throw new OrderValidationException("M├ú giß║úm gi├í ─æ├ú tß╗ôn tß║íi.");
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

    private static bool? ParseAdminStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status) ||
            string.Equals(status.Trim(), "ALL", StringComparison.OrdinalIgnoreCase))
            return null;

        return status.Trim().ToUpperInvariant() switch
        {
            "ACTIVE" => true,
            "INACTIVE" => false,
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
        var itemList = items.ToList();
        var totalAmount = itemList.Sum(i => i.SubTotal);
        var safeManualDiscount = Math.Min(Math.Max(0, manualDiscount), totalAmount);
        var baseAfterManualDiscount = Math.Max(0, totalAmount - safeManualDiscount);

        if (promotion.MinimumOrderAmount > 0 &&
            baseAfterManualDiscount < promotion.MinimumOrderAmount)
            throw new OrderValidationException(
                $"─Éãín h├áng cß║ºn tß╗æi thiß╗âu {FormatVietnamAmount(promotion.MinimumOrderAmount)}─æ ─æß╗â ├íp dß╗Ñng m├ú {promotion.PromoCode}.");

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
            errors.Add("─Éãín h├áng phß║úi c├│ ├¡t nhß║Ñt 1 sß║ún phß║®m.");

        var result = new List<PromotionCalculationItem>();
        if (items is not null)
        {
            for (var i = 0; i < items.Count; i++)
            {
                var item = items[i];
                if (item.SkuId == Guid.Empty)
                    errors.Add($"Sß║ún phß║®m [{i + 1}]: SkuId kh├┤ng hß╗úp lß╗ç.");
                if (item.Quantity < 1)
                    errors.Add($"Sß║ún phß║®m [{i + 1}]: Sß╗æ lã░ß╗úng phß║úi >= 1.");
                if (item.UnitPrice < 0)
                    errors.Add($"Sß║ún phß║®m [{i + 1}]: ─Éãín gi├í kh├┤ng ─æã░ß╗úc ├óm.");

                var subTotal = item.SubTotal ?? item.UnitPrice * item.Quantity;
                if (subTotal < 0)
                    errors.Add($"Sß║ún phß║®m [{i + 1}]: Th├ánh tiß╗ün kh├┤ng ─æã░ß╗úc ├óm.");

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
        bool validateValidFromNotPast,
        DateTime nowUtc)
    {
        var errors = new List<string>();
        var normalizedCode = NormalizePromoCode(promoCode, errors);
        var parsedDiscountType = ParseDiscountType(discountType, errors);
        var parsedScopeType = ParseScopeType(scopeType, errors);
        var normalizedMinimumOrderAmount = minimumOrderAmount ?? 0m;
        var normalizedUsageLimitTotal = NormalizeUsageLimit(
            usageLimitTotal,
            "Giß╗øi hß║ín tß╗òng lã░ß╗út d├╣ng kh├┤ng hß╗úp lß╗ç.",
            errors);
        var normalizedUsageLimitPerCustomer = NormalizeUsageLimit(
            usageLimitPerCustomer,
            "Giß╗øi hß║ín lã░ß╗út d├╣ng mß╗ùi kh├ích kh├┤ng hß╗úp lß╗ç.",
            errors);
        decimal? normalizedMaxDiscountAmount = null;

        if (discountValue <= 0)
            errors.Add("Gi├í trß╗ï giß║úm gi├í phß║úi lß╗øn hãín 0.");
        if (normalizedMinimumOrderAmount < 0)
            errors.Add("─Éãín tß╗æi thiß╗âu kh├┤ng ─æã░ß╗úc ├óm.");

        if (parsedDiscountType == PromotionDiscountType.PERCENTAGE &&
            discountValue > MaxPercentageDiscountValue)
            errors.Add("M├ú giß║úm percentage kh├┤ng qu├í 90%.");

        if (parsedDiscountType == PromotionDiscountType.PERCENTAGE)
        {
            if (!maxDiscountAmount.HasValue || maxDiscountAmount.Value <= 0)
                errors.Add("Giß║úm tß╗æi ─æa phß║úi lß╗øn hãín 0.");
            else if (maxDiscountAmount.Value > MaxPercentageDiscountAmount)
                errors.Add("Giß║úm tß╗æi ─æa kh├┤ng qu├í 10.000.000─æ.");
            else
                normalizedMaxDiscountAmount = maxDiscountAmount.Value;
        }

        if (parsedDiscountType == PromotionDiscountType.FIXED &&
            discountValue > MaxFixedDiscountValue)
            errors.Add("M├ú giß║úm FIXED kh├┤ng qu├í 10.000.000─æ.");

        if (parsedDiscountType == PromotionDiscountType.FIXED &&
            normalizedMinimumOrderAmount > 0 &&
            discountValue > normalizedMinimumOrderAmount)
            errors.Add("Sß╗æ tiß╗ün giß║úm cß╗æ ─æß╗ïnh kh├┤ng ─æã░ß╗úc lß╗øn hãín ─æãín tß╗æi thiß╗âu.");

        if (normalizedUsageLimitTotal.HasValue &&
            normalizedUsageLimitPerCustomer.HasValue &&
            normalizedUsageLimitPerCustomer.Value > normalizedUsageLimitTotal.Value)
            errors.Add("Giß╗øi hß║ín lã░ß╗út d├╣ng mß╗ùi kh├ích kh├┤ng ─æã░ß╗úc lß╗øn hãín tß╗òng lã░ß╗út d├╣ng.");

        var validFromUtc = NormalizeValidFromUtc(
            AsNullableUtc(validFrom),
            validateValidFromNotPast,
            nowUtc,
            errors);
        var validToUtc = AsNullableUtc(validTo);
        if (validFromUtc.HasValue && validToUtc.HasValue && validToUtc.Value <= validFromUtc.Value)
            errors.Add("Thß╗Øi gian kß║┐t th├║c phß║úi sau thß╗Øi gian bß║»t ─æß║ºu.");

        var normalizedSkuScopes = NormalizeSkuScopes(parsedScopeType, skuIds, skuScopes, errors);
        var normalizedCategoryScopes = NormalizeCategoryScopes(
            parsedScopeType,
            categoryIds,
            categoryScopes,
            errors);

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
            normalizedCategoryScopes);
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
            errors.Add("Promotion ├íp dß╗Ñng theo SKU phß║úi chß╗ìn ├¡t nhß║Ñt 1 SKU.");

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

    private static string? NormalizePromoCode(string? promoCode, List<string> errors)
    {
        if (string.IsNullOrWhiteSpace(promoCode))
        {
            errors.Add("M├ú giß║úm gi├í kh├┤ng ─æã░ß╗úc ─æß╗â trß╗æng.");
            return null;
        }

        var normalizedCode = promoCode.Trim().ToUpperInvariant();
        if (normalizedCode.Length is < 3 or > 50)
            errors.Add("M├ú giß║úm gi├í phß║úi tß╗½ 3 ─æß║┐n 50 k├¢ tß╗▒.");
        if (!PromoCodeRegex.IsMatch(normalizedCode))
            errors.Add("M├ú giß║úm gi├í chß╗ë ─æã░ß╗úc chß╗®a chß╗» c├íi, sß╗æ, dß║Ñu gß║ích ngang hoß║Àc gß║ích dã░ß╗øi.");

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
            errors.Add("Loß║íi giß║úm gi├í kh├┤ng ─æã░ß╗úc ─æß╗â trß╗æng.");
            return null;
        }

        var normalizedType = discountType.Trim().ToUpperInvariant();
        if (normalizedType is "PERCENTAGE" or "FIXED" &&
            Enum.TryParse<PromotionDiscountType>(normalizedType, out var parsed))
            return parsed;

        errors.Add("Loß║íi giß║úm gi├í chß╗ë hß╗ù trß╗ú PERCENTAGE hoß║Àc FIXED.");
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
        if (promotion.ValidToUtc.HasValue && AsUtc(promotion.ValidToUtc.Value) < nowUtc)
            return false;

        return true;
    }

    private async Task<PromotionUsageSnapshot> ValidateUsageLimitsAsync(
        Promotion promotion,
        Guid? customerId,
        CancellationToken ct)
    {
        var usedTotal = await _promotionRepo.CountOrdersUsingPromotionAsync(promotion.Id, ct);
        var totalLimit = NormalizeConfiguredUsageLimit(promotion.UsageLimitTotal);
        if (totalLimit.HasValue && usedTotal >= totalLimit.Value)
            throw new OrderValidationException("M├ú giß║úm gi├í ─æ├ú hß║┐t lã░ß╗út sß╗¡ dß╗Ñng.");

        var perCustomerLimit = NormalizeConfiguredUsageLimit(promotion.UsageLimitPerCustomer);
        if (perCustomerLimit.HasValue)
        {
            if (!customerId.HasValue || customerId.Value == Guid.Empty)
                throw new OrderValidationException("Vui l├▓ng chß╗ìn kh├ích h├áng ─æß╗â ├íp dß╗Ñng m├ú n├áy.");

            var usedByCustomer = await _promotionRepo.CountOrdersUsingPromotionByCustomerAsync(
                promotion.Id,
                customerId.Value,
                ct);

            if (usedByCustomer >= perCustomerLimit.Value)
                throw new OrderValidationException("Kh├ích h├áng ─æ├ú sß╗¡ dß╗Ñng hß║┐t lã░ß╗út cho m├ú giß║úm gi├í n├áy.");
        }

        return new PromotionUsageSnapshot(usedTotal);
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
        if (!promotion.IsActive)
            return "deactivated";
        if (promotion.ValidFromUtc is null && promotion.ValidToUtc is null)
            return "unlimited";
        if (promotion.ValidFromUtc.HasValue && AsUtc(promotion.ValidFromUtc.Value) > nowUtc)
            return "not_started";
        if (promotion.ValidToUtc.HasValue && AsUtc(promotion.ValidToUtc.Value) < nowUtc)
            return "expired";

        return "active";
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

    private static PromotionResponse MapToResponse(Promotion promotion, int orderCount) => new(
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
        GetValidityStatus(promotion, DateTime.UtcNow),
        promotion.IsActive,
        promotion.ScopeType.ToString(),
        MapScopes(promotion),
        MapCategoryScopes(promotion),
        orderCount);

    private static PromotionLookupResponse MapToLookupResponse(Promotion promotion, int usedCountTotal = 0) => new(
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
        GetValidityStatus(promotion, DateTime.UtcNow),
        promotion.IsActive,
        promotion.ScopeType.ToString(),
        MapScopes(promotion),
        MapCategoryScopes(promotion));

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

        errors.Add("Thß╗Øi gian bß║»t ─æß║ºu kh├┤ng ─æã░ß╗úc ß╗ƒ qu├í khß╗®.");
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
        List<PromotionCategoryScopeInput> CategoryScopes);

    private record PromotionScopeInput(
        Guid SkuId,
        string? SkuCode,
        string? SkuName);

    private record PromotionCategoryScopeInput(
        int CategoryId,
        string? CategoryName);

    private record PromotionCalculationResult(
        decimal DiscountAmount,
        decimal EligibleSubtotal);

    private record PromotionUsageSnapshot(int UsedCountTotal);
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
