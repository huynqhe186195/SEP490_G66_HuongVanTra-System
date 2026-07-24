namespace CustomerService.Application.Interfaces;

public record CustomerAccessContext(
    Guid UserId,
    bool CanViewAllCustomers,
    bool CanManageCorporateCustomers = false)
{
    /// <summary>Sale chỉ thấy khách hàng được gán; quyền xem toàn bộ không áp dụng filter.</summary>
    public Guid? AssignedSaleFilter =>
        CanViewAllCustomers ? null : UserId;

    /// <summary>
    /// Sale chỉ được đọc và thao tác trên khách hàng được gán cho chính mình.
    /// </summary>
    public bool CanAccessCustomer(Guid? assignedSaleId) =>
        CanViewAllCustomers
        || (assignedSaleId.HasValue && assignedSaleId.Value == UserId);
}
