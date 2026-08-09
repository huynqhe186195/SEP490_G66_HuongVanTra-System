using System.Text.RegularExpressions;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.Validation;

public static class OrderInputValidator
{
    /// <summary>
    /// Placeholder CRM khi KH chưa có địa chỉ thật — không đủ điều kiện giao hàng/COD.
    /// </summary>
    public const string PlaceholderShippingAddress = "Chưa có địa chỉ giao hàng";

    public static bool IsMissingOrPlaceholderShippingAddress(string? shippingAddress)
    {
        if (string.IsNullOrWhiteSpace(shippingAddress))
            return true;
        return string.Equals(
            shippingAddress.Trim(),
            PlaceholderShippingAddress,
            StringComparison.OrdinalIgnoreCase);
    }

    public static void ValidateCreateOrder(
        List<CreateOrderDetailInput> items,
        decimal discountAmount,
        decimal paidAmount,
        OrderChannel channel,
        string? shippingAddress,
        bool hasCustomBundles = false)
    {
        var errors = new List<string>();

        if ((items == null || items.Count == 0) && !hasCustomBundles)
            errors.Add("Đơn hàng phải có ít nhất 1 sản phẩm.");

        if (items != null)
        {
            for (int i = 0; i < items.Count; i++)
            {
                var item = items[i];
                if (item.SkuId == Guid.Empty)
                    errors.Add($"Sản phẩm [{i + 1}]: SkuId không hợp lệ.");
                if (string.IsNullOrWhiteSpace(item.SkuSnapshotName))
                    errors.Add($"Sản phẩm [{i + 1}]: Tên sản phẩm không được để trống.");
                else if (item.SkuSnapshotName.Trim().Length > 255)
                    errors.Add($"Sản phẩm [{i + 1}]: Tên sản phẩm tối đa 255 ký tự.");
                if (item.Quantity < 1)
                    errors.Add($"Sản phẩm [{i + 1}]: Số lượng phải >= 1.");
                if (item.UnitPrice < 0)
                    errors.Add($"Sản phẩm [{i + 1}]: Đơn giá không được âm.");
                if (item.UnitPrice > 1_000_000_000)
                    errors.Add($"Sản phẩm [{i + 1}]: Đơn giá tối đa 1,000,000,000.");
            }
        }

        if (discountAmount < 0)
            errors.Add("Giảm giá không được âm.");

        if (paidAmount < 0)
            errors.Add("Số tiền thanh toán không được âm.");

        if (channel is OrderChannel.Website or OrderChannel.Zalo or OrderChannel.Phone or OrderChannel.COD)
        {
            if (IsMissingOrPlaceholderShippingAddress(shippingAddress))
                errors.Add("Đơn hàng giao hàng phải có địa chỉ giao hàng hợp lệ (không dùng placeholder).");
        }

        if (errors.Count > 0)
            throw new OrderValidationException(errors);
    }

    public static void ValidateShippingAddressForChannel(OrderChannel channel, string? shippingAddress)
    {
        if (channel is not (OrderChannel.Website or OrderChannel.Zalo or OrderChannel.Phone or OrderChannel.COD))
            return;
        if (IsMissingOrPlaceholderShippingAddress(shippingAddress))
            throw new OrderValidationException(
                "Đơn hàng giao hàng phải có địa chỉ giao hàng hợp lệ (không dùng placeholder).");
    }

    public static void ValidatePagination(int page, int pageSize)
    {
        var errors = new List<string>();
        if (page < 1) errors.Add("Trang phải >= 1.");
        if (pageSize < 1 || pageSize > 1000) errors.Add("Kích thước trang phải từ 1 đến 1000.");
        if (errors.Count > 0) throw new OrderValidationException(errors);
    }
}

public record CreateOrderDetailInput(
    Guid SkuId,
    string SkuSnapshotName,
    string? SkuSnapshotCode,
    string? CategorySnapshotName,
    int Quantity,
    decimal CostPrice,
    decimal UnitPrice,
    bool IsGift = false,
    int? CategoryId = null,
    string? UnitSnapshot = null
);
