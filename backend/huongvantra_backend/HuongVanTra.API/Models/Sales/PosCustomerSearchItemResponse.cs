namespace HuongVanTra.API.Models.Sales {
    public class PosCustomerSearchItemResponse {
        public int CustomerId { get; set; }
        public string CustomerCode { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? TierCode { get; set; }
        public decimal TierDiscountPercent { get; set; }
    }
}
