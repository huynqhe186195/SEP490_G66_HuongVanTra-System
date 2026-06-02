namespace HuongVanTra.Service.Employees {
    public class UpdateEmployeeRequest {
        public string? FullName { get; set; }
        public int DepartmentId { get; set; }
        public int StoreId { get; set; }
        public string? Status { get; set; }
    }
}
