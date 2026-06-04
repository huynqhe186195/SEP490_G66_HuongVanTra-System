namespace HuongVanTra.Service.Customers {
    public class UpdateCustomerRequest {
        public string? FullName { get; set; }
        public string? CustomerType { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public int? TierId { get; set; }
        public int? AssignedEmployeeId { get; set; }
    }
}
