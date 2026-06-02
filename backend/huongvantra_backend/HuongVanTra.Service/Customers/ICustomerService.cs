namespace HuongVanTra.Service.Customers {
    public interface ICustomerService {
        Task<CustomerAccessContext?> GetAccessContextAsync(int currentUserId);

        Task<List<CustomerListItemResponse>> GetCustomersAsync(
            string? keyword,
            string? customerType,
            string? status,
            int? tierId,
            int? assignedEmployeeId,
            CustomerAccessContext accessContext,
            bool forPos = false);

        Task<CustomerResult> GetCustomerByIdAsync(int id, CustomerAccessContext accessContext);
        Task<CustomerResult> CreateCustomerAsync(CreateCustomerRequest request, CustomerAccessContext accessContext);
        Task<CustomerResult> UpdateCustomerAsync(int id, UpdateCustomerRequest request, CustomerAccessContext accessContext);
        Task<CustomerResult> ChangeStatusAsync(int id, ChangeCustomerStatusRequest request);
        Task<CustomerPurchaseHistoryResult> GetPurchaseHistoryAsync(int id, CustomerAccessContext accessContext);
    }
}
