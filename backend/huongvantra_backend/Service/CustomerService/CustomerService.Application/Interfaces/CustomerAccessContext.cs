namespace CustomerService.Application.Interfaces;

public record CustomerAccessContext(
    Guid UserId,
    bool CanViewAllCustomers,
    bool CanManageCorporateCustomers = false)
{
    /// <summary>
    /// Sale được xem và tra cứu toàn bộ khách hàng trong phạm vi cửa hàng nên
    /// danh sách/tìm kiếm không lọc theo Sale phụ trách.
    /// </summary>
    public Guid? AssignedSaleFilter => null;

    /// <summary>
    /// Quyền thao tác (sửa, xóa, khôi phục, thay đổi công nợ) vẫn giới hạn ở
    /// khách hàng được gán cho chính Sale đó.
    /// </summary>
    public bool CanModifyCustomer(Guid? assignedSaleId) =>
        CanViewAllCustomers
        || (assignedSaleId.HasValue && assignedSaleId.Value == UserId);
}
