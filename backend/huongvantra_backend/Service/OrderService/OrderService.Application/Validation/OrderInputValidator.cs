using System.Text.RegularExpressions;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.Validation;

public static class OrderInputValidator
{
    public static void ValidateCreateOrder(
        List<CreateOrderDetailInput> items,
        decimal discountAmount,
        decimal paidAmount,
        OrderChannel channel,
        string? shippingAddress)
    {
        var errors = new List<string>();

        if (items == null || items.Count == 0)
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
            if (string.IsNullOrWhiteSpace(shippingAddress))
                errors.Add("Đơn hàng giao hàng phải có địa chỉ giao hàng.");
        }

        if (errors.Count > 0)
            throw new OrderValidationException(errors);
    }

    public static void ValidatePagination(int page, int pageSize)
    {
        var errors = new List<string>();
        if (page < 1) errors.Add("Trang phải >= 1.");
        if (pageSize < 1 || pageSize > 100) errors.Add("Kích thước trang phải từ 1 đến 100.");
        if (errors.Count > 0) throw new OrderValidationException(errors);
    }
}

public record CreateOrderDetailInput(
    Guid SkuId,
    string SkuSnapshotName,
    string? SkuSnapshotCode,
    int Quantity,
    decimal UnitPrice,
    int? CategoryId = null
);
