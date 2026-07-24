using OrderService.Application.Authorization;
using OrderService.Application.Interfaces;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.Authorization;

/// <summary>
/// Nhân viên (Sale/Warehouse) chỉ thao tác khi đang trong ca đã duyệt.
/// Manager/Admin (CanViewAllOrders) được bỏ qua.
/// </summary>
public class StaffShiftGuard(IShiftCatalogClient shifts)
{
    public const string ShelfArea = "Shelf";
    public const string WarehouseArea = "Warehouse";

    public Task EnsureShelfOnDutyAsync(OrderAccessContext access, CancellationToken ct = default) =>
        EnsureShelfOnDutyAsync(access.CanViewAllOrders, ct);

    /// <summary>Dùng cho các thao tác không có sẵn <see cref="OrderAccessContext"/> (ví dụ đóng ca quỹ).</summary>
    public async Task EnsureShelfOnDutyAsync(bool canViewAllOrders, CancellationToken ct = default)
    {
        if (canViewAllOrders) return;

        var onDuty = await shifts.GetMyOnDutyAsync(ShelfArea, ct);
        if (onDuty is null)
            throw new OrderValidationException(
                "Bạn chưa đến ca / chưa được duyệt ca quầy — không thể thao tác đơn hàng, trả đổi hay thu COD. Vào «Ca của tôi» để đăng ký hoặc chờ đến giờ ca.");
    }

    public async Task EnsureWarehouseOnDutyAsync(CancellationToken ct = default)
    {
        var onDuty = await shifts.GetMyOnDutyAsync(WarehouseArea, ct);
        if (onDuty is null)
            throw new OrderValidationException(
                "Bạn chưa đến ca / chưa được duyệt ca kho — không thể đóng gói. Vào «Ca của tôi» để đăng ký hoặc chờ đến giờ ca.");
    }
}
