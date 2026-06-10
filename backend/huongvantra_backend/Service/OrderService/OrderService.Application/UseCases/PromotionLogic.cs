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
    private const decimal MaxDiscountValue = 1_000_000_000m;
    private const string InvalidLookupMessage = "Mã giảm giá không hợp lệ hoặc đã hết hiệu lực.";
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

    public async Task<PromotionResponse> CreateAsync(CreatePromotionRequest req, CancellationToken ct = default)
    {
        var input = ValidatePromotionInput(
            req.PromoCode,
            req.DiscountType,
            req.DiscountValue,
            req.ValidFrom,
            req.ValidTo);

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
            ValidFromUtc = input.ValidFromUtc,
            ValidToUtc = input.ValidToUtc,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

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
            req.ValidFrom,
            req.ValidTo);

        var orderCount = await _promotionRepo.CountOrdersUsingPromotionAsync(promotion.Id, ct);
        var changesImmutableFields =
            promotion.NormalizedPromoCode != input.NormalizedPromoCode ||
            promotion.DiscountType != input.DiscountType ||
            promotion.DiscountValue != input.DiscountValue;

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
        }

        promotion.ValidFromUtc = input.ValidFromUtc;
        promotion.ValidToUtc = input.ValidToUtc;
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

    public async Task<PromotionDiscountResult> ValidateAndCalculateDiscountAsync(
        Guid? promotionId,
        string? promotionCode,
        decimal baseForPromotion,
        CancellationToken ct = default)
    {
        var hasPromotionId = promotionId.HasValue && promotionId.Value != Guid.Empty;
        var hasPromotionCode = !string.IsNullOrWhiteSpace(promotionCode);

        if (!hasPromotionId && !hasPromotionCode)
            return PromotionDiscountResult.Empty;

        Promotion? promotion;
        if (hasPromotionId)
        {
            promotion = await _promotionRepo.GetByIdAsync(promotionId!.Value, ct);
        }
        else
        {
            var normalizedCode = NormalizeLookupCode(promotionCode);
            promotion = await _promotionRepo.GetActiveByNormalizedCodeAsync(normalizedCode, ct);
        }

        if (promotion is null || !IsCurrentlyUsable(promotion, DateTime.UtcNow))
            throw new OrderValidationException(InvalidLookupMessage);

        var discountAmount = CalculateDiscount(promotion, Math.Max(0, baseForPromotion));
        return new PromotionDiscountResult(promotion.Id, promotion.PromoCode, discountAmount);
    }

    private static PromotionInput ValidatePromotionInput(
        string? promoCode,
        string? discountType,
        decimal discountValue,
        DateOnly? validFrom,
        DateOnly? validTo)
    {
        var errors = new List<string>();
        var normalizedCode = NormalizePromoCode(promoCode, errors);
        var parsedDiscountType = ParseDiscountType(discountType, errors);

        if (discountValue <= 0)
            errors.Add("Giá trị giảm giá phải lớn hơn 0.");
        if (discountValue > MaxDiscountValue)
            errors.Add("Giá trị giảm giá tối đa 1,000,000,000.");

        if (parsedDiscountType == PromotionDiscountType.PERCENTAGE && discountValue > 100)
            errors.Add("Giá trị giảm theo phần trăm phải nhỏ hơn hoặc bằng 100.");

        if (validFrom.HasValue && validTo.HasValue && validFrom.Value > validTo.Value)
            errors.Add("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");

        if (errors.Count > 0)
            throw new OrderValidationException(errors);

        return new PromotionInput(
            normalizedCode!,
            parsedDiscountType!.Value,
            discountValue,
            ToStartOfDayUtc(validFrom),
            ToEndOfDayUtc(validTo));
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

    private static PromotionResponse MapToResponse(Promotion promotion, int orderCount) => new(
        promotion.Id,
        promotion.PromoCode,
        promotion.DiscountType.ToString(),
        promotion.DiscountValue,
        AsNullableUtc(promotion.ValidFromUtc),
        AsNullableUtc(promotion.ValidToUtc),
        GetValidityStatus(promotion, DateTime.UtcNow),
        promotion.IsActive,
        orderCount);

    private static PromotionLookupResponse MapToLookupResponse(Promotion promotion) => new(
        promotion.Id,
        promotion.PromoCode,
        promotion.DiscountType.ToString(),
        promotion.DiscountValue,
        AsNullableUtc(promotion.ValidFromUtc),
        AsNullableUtc(promotion.ValidToUtc),
        GetValidityStatus(promotion, DateTime.UtcNow),
        promotion.IsActive);

    private static DateTime? ToStartOfDayUtc(DateOnly? date) =>
        date.HasValue
            ? DateTime.SpecifyKind(date.Value.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc)
            : null;

    private static DateTime? ToEndOfDayUtc(DateOnly? date) =>
        date.HasValue
            ? DateTime.SpecifyKind(date.Value.ToDateTime(new TimeOnly(23, 59, 59)), DateTimeKind.Utc)
            : null;

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
        DateTime? ValidToUtc);
}

public record PromotionDiscountResult(
    Guid? PromotionId,
    string? PromotionCode,
    decimal DiscountAmount)
{
    public static PromotionDiscountResult Empty { get; } = new(null, null, 0);
}
