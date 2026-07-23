using OrderService.Domain.Exceptions;

namespace OrderService.Domain.Rules;

public static class OrderBusinessRules
{
    public static void EnsureManualDiscountAllowed(
        decimal manualDiscount,
        string? customerGroup,
        int? tierId = null)
    {
        if (manualDiscount <= 0)
            return;

        if (string.Equals(
            customerGroup?.Trim(),
            "DoiNgoai",
            StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        _ = tierId;
        throw new OrderValidationException(
            "Chiết khấu thủ công chỉ dành cho khách đối ngoại (VIP). Hạng thành viên không cấp quyền giảm giá thủ công.");
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

    private static bool IsGram(string? inventoryUnit) =>
        string.Equals(inventoryUnit?.Trim(), "Gram", StringComparison.OrdinalIgnoreCase);

    private static bool IsPiece(string? inventoryUnit) =>
        string.Equals(inventoryUnit?.Trim(), "Piece", StringComparison.OrdinalIgnoreCase);
}
