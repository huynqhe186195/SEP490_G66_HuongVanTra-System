using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Application.Authorization;

/// <summary>
/// SalePos (VIEW/CREATE_ORDER): chỉ đơn của mình.
/// SaleCod (VERIFY_COD, không Manager): mọi đơn COD, không xem đơn quầy/khác.
/// Manager/Admin/Kế toán: toàn bộ đơn.
/// </summary>
public record OrderAccessContext(
    Guid UserId,
    bool CanViewAllOrders,
    bool CodOrdersOnly = false)
{
    public Guid? EmployeeFilter => CanViewAllOrders || CodOrdersOnly ? null : UserId;

    public bool CanAccessOrder(Order order)
    {
        if (CodOrdersOnly && !IsCodOrder(order))
            return false;

        if (CanViewAllOrders || CodOrdersOnly)
            return true;

        return order.EmployeeId.HasValue && order.EmployeeId.Value == UserId;
    }

    /// <summary>
    /// Overload chỉ theo EmployeeId — không dùng cho SaleCod (cần OrderChannel).
    /// Prefer <see cref="CanAccessOrder(Order)"/>.
    /// </summary>
    public bool CanAccessOrder(Guid? employeeId) =>
        !CodOrdersOnly
        && (CanViewAllOrders || (employeeId.HasValue && employeeId.Value == UserId));

    public static bool IsCodOrder(Order order) =>
        order.OrderChannel == OrderChannel.COD;
}
