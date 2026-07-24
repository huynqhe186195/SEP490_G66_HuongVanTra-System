using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Application.Authorization;

/// <summary>
/// SalePos (CREATE_POS_ORDER): đơn của mình theo chính sách hiện tại, không gồm COD.
/// SaleCod (CREATE_COD_ORDER): mọi đơn COD, không xem đơn quầy/khác.
/// Người có cả hai permission nhận hợp của hai phạm vi trên.
/// Manager/Admin/Kế toán: toàn bộ đơn.
/// </summary>
public record OrderAccessContext(
    Guid UserId,
    bool CanViewAllOrders,
    bool CanViewAllCodOrders = false,
    bool CanViewOwnOrders = true)
{
    public bool CodOrdersOnly =>
        !CanViewAllOrders && CanViewAllCodOrders && !CanViewOwnOrders;

    public bool IncludeAllCodOrders =>
        !CanViewAllOrders && CanViewAllCodOrders && CanViewOwnOrders;

    public Guid? EmployeeFilter =>
        CanViewAllOrders || CodOrdersOnly
            ? null
            : CanViewOwnOrders
                ? UserId
                : Guid.Empty;

    public bool CanAccessOrder(Order order)
    {
        if (CanViewAllOrders)
            return true;

        if (IsCodOrder(order))
            return CanViewAllCodOrders;

        return CanViewOwnOrders
            && order.EmployeeId.HasValue
            && order.EmployeeId.Value == UserId;
    }

    /// <summary>
    /// Overload chỉ theo EmployeeId — không dùng cho SaleCod (cần OrderChannel).
    /// Prefer <see cref="CanAccessOrder(Order)"/>.
    /// </summary>
    public bool CanAccessOrder(Guid? employeeId) =>
        CanViewAllOrders
        || (CanViewOwnOrders
            && employeeId.HasValue
            && employeeId.Value == UserId);

    public static bool IsCodOrder(Order order) =>
        order.OrderChannel == OrderChannel.COD;
}
