using OrderService.Domain.Exceptions;

namespace OrderService.Domain.Rules;

public static class OrderBusinessRules
{
    public const string ZeroTotalOrderMessage =
        "Đơn hàng 0 đồng chỉ được phép khi có khuyến mãi hợp lệ giảm toàn bộ giá trị thanh toán hoặc toàn bộ đơn là quà tặng cho khách đối ngoại (VIP).";

    public static void EnsureManualDiscountAllowed(
        decimal manualDiscount,
        string? customerGroup,
        int? tierId = null,
        decimal? contractDiscountPercent = null,
        decimal subtotal = 0m)
    {
        if (manualDiscount <= 0)
            return;

        if (IsGroup(customerGroup, "DoiNgoai"))
            return;

        if (IsGroup(customerGroup, "DoanhNghiep"))
        {
            if (contractDiscountPercent is null)
                throw new OrderValidationException(
                    "Khách doanh nghiệp cần hợp đồng đang hiệu lực có quy định chiết khấu mới được áp chiết khấu thủ công.");

            var maxDiscount = Math.Round(subtotal * contractDiscountPercent.Value / 100m, 0, MidpointRounding.AwayFromZero);
            if (manualDiscount > maxDiscount)
                throw new OrderValidationException(
                    $"Chiết khấu vượt mức hợp đồng cho phép ({contractDiscountPercent.Value:0.##}% ≈ {maxDiscount:N0}đ).");

            return;
        }

        _ = tierId;
        throw new OrderValidationException(
            "Chiết khấu thủ công chỉ dành cho khách đối ngoại (VIP). Hạng thành viên không cấp quyền giảm giá thủ công.");
    }

    public static void EnsureContractRequiredForCorporate(string? customerGroup, Guid? contractId)
    {
        if (!IsGroup(customerGroup, "DoanhNghiep"))
            return;

        if (contractId.HasValue && contractId.Value != Guid.Empty)
            return;

        throw new OrderValidationException(
            "Khách doanh nghiệp phải có hợp đồng đang hiệu lực mới được tạo đơn hàng.");
    }

    public static void EnsureCreditLimitNotExceeded(
        decimal currentDebt,
        decimal unpaidAmount,
        decimal? creditLimit)
    {
        if (creditLimit is null || unpaidAmount <= 0)
            return;

        var projectedDebt = currentDebt + unpaidAmount;
        if (projectedDebt <= creditLimit.Value)
            return;

        throw new OrderValidationException(
            $"Đơn hàng vượt hạn mức công nợ hợp đồng. Nợ hiện tại {currentDebt:N0}đ + ghi nợ đơn này {unpaidAmount:N0}đ = {projectedDebt:N0}đ, vượt hạn mức {creditLimit.Value:N0}đ.");
    }

    public static void EnsureGuestFullyPaid(
        Guid? customerId,
        decimal paidAmount,
        decimal finalAmount)
    {
        if (customerId.HasValue && customerId.Value != Guid.Empty)
            return;

        if (paidAmount >= finalAmount)
            return;

        throw new OrderValidationException(
            "Khách lẻ phải thanh toán đủ. Vui lòng đăng ký/chọn khách hàng trước khi bán nợ hoặc thanh toán một phần.");
    }

    public static void EnsureSaleLinesHavePositivePrice(
        IEnumerable<(decimal UnitPrice, bool IsGift)> lines)
    {
        if (lines.Any(line => !line.IsGift && line.UnitPrice <= 0))
        {
            throw new OrderValidationException(
                "Sản phẩm bán thông thường phải có đơn giá lớn hơn 0. Dòng 0 đồng phải được đánh dấu là quà tặng và chỉ áp dụng cho khách đối ngoại (VIP).");
        }
    }

    public static void EnsureManualDiscountDoesNotZeroOrder(
        decimal subtotal,
        decimal manualDiscount)
    {
        if (manualDiscount > 0 && manualDiscount >= subtotal)
        {
            throw new OrderValidationException(
                "Chiết khấu thủ công phải nhỏ hơn tạm tính đơn hàng và không được làm đơn hàng còn 0 đồng.");
        }
    }

    public static void EnsureZeroTotalOrderAllowed(
        decimal finalAmount,
        decimal subtotal,
        decimal manualDiscount,
        Guid? validatedPromotionId,
        decimal promotionDiscount,
        bool isAuthorizedVipGiftOrder)
    {
        if (finalAmount > 0)
            return;

        var hasValidatedFullPromotion =
            subtotal > 0
            && manualDiscount == 0
            && validatedPromotionId.HasValue
            && validatedPromotionId.Value != Guid.Empty
            && promotionDiscount >= subtotal;

        var isPureVipGiftOrder =
            subtotal == 0
            && manualDiscount == 0
            && isAuthorizedVipGiftOrder;

        if (!hasValidatedFullPromotion && !isPureVipGiftOrder)
            throw new OrderValidationException(ZeroTotalOrderMessage);
    }

    public static int NormalizeBaseQuantity(decimal quantity, string? inventoryUnit)
    {
        if (quantity <= 0)
            throw new OrderValidationException("Số lượng sản phẩm phải là số nguyên dương.");

        if (quantity != decimal.Truncate(quantity))
        {
            var unitLabel = IsGram(inventoryUnit) ? "gram" : "sản phẩm theo chiếc";
            throw new OrderValidationException($"Số lượng {unitLabel} phải là số nguyên dương; hệ thống không tự làm tròn.");
        }

        if (quantity > int.MaxValue)
            throw new OrderValidationException("Số lượng sản phẩm vượt quá giới hạn cho phép.");

        if (!IsGram(inventoryUnit) && !IsPiece(inventoryUnit))
            throw new OrderValidationException($"Đơn vị tồn kho '{inventoryUnit}' chưa được POS hỗ trợ.");

        return decimal.ToInt32(quantity);
    }

    private static bool IsGroup(string? customerGroup, string expected) =>
        string.Equals(customerGroup?.Trim(), expected, StringComparison.OrdinalIgnoreCase);

    private static bool IsGram(string? inventoryUnit) =>
        string.Equals(inventoryUnit?.Trim(), "Gram", StringComparison.OrdinalIgnoreCase);

    private static bool IsPiece(string? inventoryUnit) =>
        string.Equals(inventoryUnit?.Trim(), "Piece", StringComparison.OrdinalIgnoreCase);
}
