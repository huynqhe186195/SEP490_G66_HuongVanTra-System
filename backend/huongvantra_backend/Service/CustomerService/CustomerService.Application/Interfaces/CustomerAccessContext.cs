namespace CustomerService.Application.Interfaces;

public record CustomerAccessContext(
    Guid UserId,
    bool CanViewAllCustomers,
    bool CanManageCorporateCustomers = false)
{
    public Guid? AssignedSaleFilter => CanViewAllCustomers ? null : UserId;

    public bool CanAccessCustomer(Guid? assignedSaleId) =>
        CanViewAllCustomers || !assignedSaleId.HasValue || assignedSaleId.Value == UserId;
}
