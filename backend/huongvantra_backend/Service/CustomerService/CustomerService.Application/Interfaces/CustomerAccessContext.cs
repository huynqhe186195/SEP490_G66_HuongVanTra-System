namespace CustomerService.Application.Interfaces;

public record CustomerAccessContext(
    Guid UserId,
    bool CanViewAllCustomers,
    bool CanManageCorporateCustomers = false,
    bool CanCreateOrder = false,
    bool BypassAssignmentFilter = false)
{
    /// <summary>CRM list: Sale chỉ thấy KH được gán. Checkout POS/COD: bỏ filter.</summary>
    public Guid? AssignedSaleFilter =>
        CanViewAllCustomers || BypassAssignmentFilter ? null : UserId;

    /// <summary>
    /// Đọc KH để gắn đơn: Sale có CREATE_ORDER được lookup mọi KH (kể cả đang gán Sale khác).
    /// </summary>
    public bool CanAccessCustomer(Guid? assignedSaleId) =>
        CanViewAllCustomers
        || CanCreateOrder
        || BypassAssignmentFilter
        || !assignedSaleId.HasValue
        || assignedSaleId.Value == UserId;
}
