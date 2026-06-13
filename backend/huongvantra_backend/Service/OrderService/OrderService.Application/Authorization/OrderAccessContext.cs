namespace OrderService.Application.Authorization;

/// <summary>
/// Sale (chỉ VIEW_ORDER + CREATE_ORDER) chỉ thấy/sửa đơn có EmployeeId = UserId.
/// Manager/Admin/Kế toán xem toàn bộ đơn.
/// </summary>
public record OrderAccessContext(Guid UserId, bool CanViewAllOrders)
{
    public Guid? EmployeeFilter => CanViewAllOrders ? null : UserId;

    public bool CanAccessOrder(Guid? employeeId) =>
        CanViewAllOrders || (employeeId.HasValue && employeeId.Value == UserId);
}
