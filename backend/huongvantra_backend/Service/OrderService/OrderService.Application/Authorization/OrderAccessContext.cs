using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Application.Authorization;

/// <summary>
/// SalePos (CREATE_POS_ORDER): xem được mọi đơn quầy trong phạm vi cửa hàng,
/// không lọc theo Sale tạo đơn.
/// SaleCod (CREATE_COD_ORDER): mọi đơn COD, không xem đơn quầy.
/// Người có cả hai permission nhận hợp của hai phạm vi trên.
/// Manager/Admin/Kế toán: toàn bộ đơn.
/// Quyền thao tác (sửa, hủy, hoàn tiền, giao hàng, hoàn tất) vẫn giới hạn theo
/// người tạo đơn qua <see cref="CanModifyOrder(Order)"/>.
/// </summary>
public record OrderAccessContext(
    Guid UserId,
    bool CanViewAllOrders,
    bool CanViewAllCodOrders = false,
    bool CanViewOwnOrders = true,
    bool CanCreateB2BOrder = false,
    bool CanShipOrder = false,
    bool CanConfirmB2BDelivery = false)
{
    public bool CodOrdersOnly =>
        !CanViewAllOrders && CanViewAllCodOrders && !CanViewOwnOrders;

    public bool IncludeAllCodOrders =>
        !CanViewAllOrders && CanViewAllCodOrders && CanViewOwnOrders;

    /// <summary>
    /// Không lọc danh sách theo nhân viên tạo đơn: Sale được tra cứu toàn bộ đơn
    /// trong phạm vi cửa hàng. Phạm vi kênh (COD) vẫn giữ nguyên.
    /// </summary>
    public Guid? EmployeeFilter => null;

    /// <summary>
    /// Phạm vi xem/tra cứu: chỉ giới hạn theo kênh đơn, không theo người tạo.
    /// </summary>
    public bool CanViewOrder(Order order) =>
        CanViewAllOrders
        || !CodOrdersOnly
        || IsCodOrder(order);

    /// <summary>
    /// Phạm vi thao tác: giữ nguyên chính sách sở hữu hiện tại.
    /// </summary>
    public bool CanModifyOrder(Order order)
    {
        if (CanViewAllOrders)
            return true;

        // Đơn hợp đồng do Kế toán lập nhưng Thủ kho phải thao tác được bước xuất hàng.
        if (IsContractOrder(order))
            return CanShipOrder || CanConfirmB2BDelivery;

        if (IsCodOrder(order))
            return CanViewAllCodOrders;

        return CanViewOwnOrders
            && order.EmployeeId.HasValue
            && order.EmployeeId.Value == UserId;
    }

    /// <summary>
    /// Overload chỉ theo EmployeeId — không dùng cho SaleCod (cần OrderChannel).
    /// Prefer <see cref="CanModifyOrder(Order)"/>.
    /// </summary>
    public bool CanModifyOrder(Guid? employeeId) =>
        CanViewAllOrders
        || (CanViewOwnOrders
            && employeeId.HasValue
            && employeeId.Value == UserId);

    public static bool IsCodOrder(Order order) =>
        order.OrderChannel == OrderChannel.COD;

    public static bool IsContractOrder(Order order) =>
        order.ContractId.HasValue;
}
