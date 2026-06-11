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
    private const string InvalidLookupMessage = "Mã giảm giá không hợp lệ hoặc đã hết hiệu lực.";
    private const string NotApplicableMessage = "Promotion is not applicable to selected items.";
    private static readonly Regex PromoCodeRegex = new("^[A-Z0-9_-]+$", RegexOptions.Compiled);

    public async Task<List<PromotionResponse>> GetAdminPromotionsAsync(CancellationToken ct = default)
    {
        var promotions = await _promotionRepo.GetAllAsync(ct);
        var result = new List<PromotionResponse>(promotions.Count);

        foreach (var promotion in promotions)
        {
            var orderCount = await _promotionRepo.CountOrdersUsingPromotionAsync(promotion.Id, ct);
            result.Add(MapToResponse(promotion, orderCount));
        }

        return result;
    }

    public async Task<List<PromotionLookupResponse>> GetAvailablePromotionsAsync(CancellationToken ct = default)
    {
        var promotions = await _promotionRepo.GetAvailableAsync(DateTime.UtcNow, ct);
        return promotions.Select(MapToLookupResponse).ToList();
    }

    public async Task<PromotionResponse> CreateAsync(CreatePromotionRequest req, CancellationToken ct = default)
    {
        var input = ValidatePromotionInput(
            req.PromoCode,
            req.DiscountType,
            req.DiscountValue,
            req.ValidFromUtc ?? req.ValidFrom,
            req.ValidToUtc ?? req.ValidTo,
            req.IsActive,
            req.ScopeType,
            req.SkuIds,
            req.SkuScopes);

        var existing = await _promotionRepo.GetByNormalizedCodeAsync(input.NormalizedPromoCode, ct);
        if (existing is not null)
            throw new OrderValidationException("Mã giảm giá đã tồn tại.");

        var now = DateTime.UtcNow;
        var promotion = new Promotion
        {
            Id = Guid.NewGuid(),
            PromoCode = input.NormalizedPromoCode,
            NormalizedPromoCode = input.NormalizedPromoCode,
            DiscountType = input.DiscountType,
            DiscountValue = input.DiscountValue,
            ScopeType = input.ScopeType,
            ValidFromUtc = input.ValidFromUtc,
            ValidToUtc = input.ValidToUtc,
            IsActive = input.IsActive ?? true,
            CreatedAt = now,
            UpdatedAt = now
        };

        foreach (var scope in BuildPromotionScopes(promotion.Id, input.ScopeType, input.SkuScopes, now))
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

        var input = ValidatePromotionInput(
            req.PromoCode,
            req.DiscountType,
            req.DiscountValue,
            req.ValidFromUtc ?? req.ValidFrom,
            req.ValidToUtc ?? req.ValidTo,
            req.IsActive,
            req.ScopeType,
            req.SkuIds,
            req.SkuScopes);

        var orderCount = await _promotionRepo.CountOrdersUsingPromotionAsync(promotion.Id, ct);
        var changesImmutableFields =
            promotion.NormalizedPromoCode != input.NormalizedPromoCode ||
            promotion.DiscountType != input.DiscountType ||
            promotion.DiscountValue != input.DiscountValue ||
            promotion.ScopeType != input.ScopeType ||
            !SameSkuScopes(promotion.Scopes, input.SkuScopes);

        if (orderCount > 0 && changesImmutableFields)
            throw new OrderValidationException(
                "Mã giảm giá đã được sử dụng nên chỉ được cập nhật thời gian hiệu lực hoặc trạng thái.");

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
            promotion.ScopeType = input.ScopeType;
            ReplaceScopes(promotion, input.SkuScopes, DateTime.UtcNow);
        }

        promotion.ValidFromUtc = input.ValidFromUtc;
        promotion.ValidToUtc = input.ValidToUtc;
        promotion.IsActive = input.IsActive ?? promotion.IsActive;
        promotion.UpdatedAt = DateTime.UtcNow;

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

        return MapToLookupResponse(promotion);
    }

    public async Task<PromotionApplyPreviewResponse> ApplyPreviewAsync(
        PromotionApplyPreviewRequest req, CancellationToken ct = default)
    {
        var items = ValidatePreviewItems(req.Items);
        var promotion = await ResolvePromotionAsync(req.PromotionId, req.PromotionCode, ct);
        var result = CalculatePromotionDiscount(promotion, items, req.ManualDiscount);

        return new PromotionApplyPreviewResponse(
            promotion.Id,
            promotion.PromoCode,
            promotion.DiscountType.ToString(),
            promotion.DiscountValue,
            promotion.ScopeType.ToString(),
            MapScopes(promotion),
            result.DiscountAmount,
            result.EligibleSubtotal,
            "Promotion applied successfully");
    }

    public async Task<PromotionDiscountResult> ValidateAndCalculateDiscountAsync(
        Guid? promotionId,
        string? promotionCode,
        IReadOnlyCollection<PromotionCalculationItem> items,
        decimal manualDiscount,
        CancellationToken ct = default)
    {
        var hasPromotionId = promotionId.HasValue && promotionId.Value != Guid.Empty;
        var hasPromotionCode = !string.IsNullOrWhiteSpace(promotionCode);

        if (!hasPromotionId && !hasPromotionCode)
            return PromotionDiscountResult.Empty;

        var promotion = await ResolvePromotionAsync(promotionId, promotionCode, ct);
        var result = CalculatePromotionDiscount(promotion, items, manualDiscount);
        return new PromotionDiscountResult(
            promotion.Id,
            promotion.PromoCode,
            result.DiscountAmount,
            result.EligibleSubtotal);
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

        var eligibleSubtotal = promotion.ScopeType == PromotionScopeType.SKU
            ? GetEligibleSkuSubtotal(promotion, itemList)
            : totalAmount;

        if (promotion.ScopeType == PromotionScopeType.SKU && eligibleSubtotal <= 0)
            throw new OrderValidationException(NotApplicableMessage);

        var discountBase = promotion.ScopeType == PromotionScopeType.SKU
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
                    subTotal));
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
        DateTime? validFrom,
        DateTime? validTo,
        bool? isActive,
        string? scopeType,
        List<Guid>? skuIds,
        List<PromotionSkuScopeRequest>? skuScopes)
    {
        var errors = new List<string>();
        var normalizedCode = NormalizePromoCode(promoCode, errors);
        var parsedDiscountType = ParseDiscountType(discountType, errors);
        var parsedScopeType = ParseScopeType(scopeType, errors);

        if (discountValue <= 0)
            errors.Add("Giá trị giảm giá phải lớn hơn 0.");

        if (parsedDiscountType == PromotionDiscountType.PERCENTAGE &&
            discountValue > MaxPercentageDiscountValue)
            errors.Add("Mã giảm percentage không quá 90%.");

        if (parsedDiscountType == PromotionDiscountType.FIXED &&
            discountValue > MaxFixedDiscountValue)
            errors.Add("Mã giảm FIXED không quá 10.000.000đ.");

        var validFromUtc = AsNullableUtc(validFrom);
        var validToUtc = AsNullableUtc(validTo);
        if (validFromUtc.HasValue && validToUtc.HasValue && validToUtc.Value <= validFromUtc.Value)
            errors.Add("Thời gian kết thúc phải sau thời gian bắt đầu.");

        var normalizedSkuScopes = NormalizeSkuScopes(parsedScopeType, skuIds, skuScopes, errors);

        if (errors.Count > 0)
            throw new OrderValidationException(errors);

        return new PromotionInput(
            normalizedCode!,
            parsedDiscountType!.Value,
            discountValue,
            validFromUtc,
            validToUtc,
            isActive,
            parsedScopeType,
            normalizedSkuScopes);
    }

    private static PromotionScopeType ParseScopeType(string? scopeType, List<string> errors)
    {
        if (string.IsNullOrWhiteSpace(scopeType))
            return PromotionScopeType.ORDER;

        var normalizedType = scopeType.Trim().ToUpperInvariant();
        if (normalizedType is "ORDER" or "SKU" &&
            Enum.TryParse<PromotionScopeType>(normalizedType, out var parsed))
            return parsed;

        errors.Add("Phạm vi áp dụng chỉ hỗ trợ ORDER hoặc SKU.");
        return PromotionScopeType.ORDER;
    }

    private static List<PromotionScopeInput> NormalizeSkuScopes(
        PromotionScopeType scopeType,
        List<Guid>? skuIds,
        List<PromotionSkuScopeRequest>? skuScopes,
        List<string> errors)
    {
        if (scopeType == PromotionScopeType.ORDER)
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
            errors.Add("Promotion áp dụng theo SKU phải chọn ít nhất 1 SKU.");

        return bySkuId.Values.ToList();
    }

    private static string? NormalizePromoCode(string? promoCode, List<string> errors)
    {
        if (string.IsNullOrWhiteSpace(promoCode))
        {
            errors.Add("Mã giảm giá không được để trống.");
            return null;
        }

        var normalizedCode = promoCode.Trim().ToUpperInvariant();
        if (normalizedCode.Length is < 3 or > 50)
            errors.Add("Mã giảm giá phải từ 3 đến 50 ký tự.");
        if (!PromoCodeRegex.IsMatch(normalizedCode))
            errors.Add("Mã giảm giá chỉ được chứa chữ cái, số, dấu gạch ngang hoặc gạch dưới.");

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
            errors.Add("Loại giảm giá không được để trống.");
            return null;
        }

        var normalizedType = discountType.Trim().ToUpperInvariant();
        if (normalizedType is "PERCENTAGE" or "FIXED" &&
            Enum.TryParse<PromotionDiscountType>(normalizedType, out var parsed))
            return parsed;

        errors.Add("Loại giảm giá chỉ hỗ trợ PERCENTAGE hoặc FIXED.");
        return null;
    }

    private static decimal CalculateDiscount(Promotion promotion, decimal baseForPromotion)
    {
        if (baseForPromotion <= 0)
            return 0;

        return promotion.DiscountType switch
        {
            PromotionDiscountType.FIXED => Math.Min(promotion.DiscountValue, baseForPromotion),
            PromotionDiscountType.PERCENTAGE => Math.Min(
                Math.Round(baseForPromotion * promotion.DiscountValue / 100m, 0, MidpointRounding.AwayFromZero),
                baseForPromotion),
            _ => 0
        };
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
        List<PromotionScopeInput> scopes,
        DateTime now)
    {
        if (scopeType == PromotionScopeType.ORDER)
            return [];

        return scopes.Select(scope => new PromotionScope
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

    private static void ReplaceScopes(
        Promotion promotion,
        List<PromotionScopeInput> nextScopes,
        DateTime now)
    {
        foreach (var scope in promotion.Scopes)
        {
            scope.IsDeleted = true;
            scope.UpdatedAt = now;
        }

        foreach (var scope in BuildPromotionScopes(promotion.Id, promotion.ScopeType, nextScopes, now))
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

    private static PromotionResponse MapToResponse(Promotion promotion, int orderCount) => new(
        promotion.Id,
        promotion.PromoCode,
        promotion.DiscountType.ToString(),
        promotion.DiscountValue,
        AsNullableUtc(promotion.ValidFromUtc),
        AsNullableUtc(promotion.ValidToUtc),
        GetValidityStatus(promotion, DateTime.UtcNow),
        promotion.IsActive,
        promotion.ScopeType.ToString(),
        MapScopes(promotion),
        orderCount);

    private static PromotionLookupResponse MapToLookupResponse(Promotion promotion) => new(
        promotion.Id,
        promotion.PromoCode,
        promotion.DiscountType.ToString(),
        promotion.DiscountValue,
        AsNullableUtc(promotion.ValidFromUtc),
        AsNullableUtc(promotion.ValidToUtc),
        GetValidityStatus(promotion, DateTime.UtcNow),
        promotion.IsActive,
        promotion.ScopeType.ToString(),
        MapScopes(promotion));

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
        DateTime? ValidFromUtc,
        DateTime? ValidToUtc,
        bool? IsActive,
        PromotionScopeType ScopeType,
        List<PromotionScopeInput> SkuScopes);

    private record PromotionScopeInput(
        Guid SkuId,
        string? SkuCode,
        string? SkuName);

    private record PromotionCalculationResult(
        decimal DiscountAmount,
        decimal EligibleSubtotal);
}

public record PromotionCalculationItem(
    Guid SkuId,
    int Quantity,
    decimal UnitPrice,
    decimal SubTotal);

public record PromotionDiscountResult(
    Guid? PromotionId,
    string? PromotionCode,
    decimal DiscountAmount,
    decimal EligibleSubtotal)
{
    public static PromotionDiscountResult Empty { get; } = new(null, null, 0, 0);
}
