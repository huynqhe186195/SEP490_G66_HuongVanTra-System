namespace HuongVanTra.Service.Customers {
    public class CustomerAccessContext {
        public bool IsSalesStaff { get; set; }
        public bool IsAdmin { get; set; }
        public bool IsAgencyManager { get; set; }
        public bool CanManageAllCustomers { get; set; }
        public int? EmployeeId { get; set; }
    }
}
