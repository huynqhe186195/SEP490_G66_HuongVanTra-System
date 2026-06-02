namespace HuongVanTra.Service.Employees {
    public interface IEmployeeService {
        Task<List<EmployeeListItemResponse>> GetEmployeesAsync(
            string? keyword,
            string? status,
            int? storeId,
            int? departmentId);

        Task<EmployeeDetailResponse?> GetEmployeeByIdAsync(int id);

        Task<EmployeeUpdateResult> UpdateEmployeeAsync(int id, UpdateEmployeeRequest request);
    }
}
