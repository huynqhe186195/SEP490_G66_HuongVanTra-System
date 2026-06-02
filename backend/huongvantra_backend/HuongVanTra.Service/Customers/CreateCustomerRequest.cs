namespace HuongVanTra.Service.Customers {
    public class CreateCustomerRequest {
        public string? CustomerCode { get; set; }
        public string? FullName { get; set; }
        public string? CustomerType { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public int? TierId { get; set; }
        public int? AssignedEmployeeId { get; set; }
    }
}
