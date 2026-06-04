namespace HuongVanTra.Service.Customers {
    public class MembershipTierResponseDto {
        public int Id { get; set; }
        public string TierCode { get; set; } = null!;
        public decimal MinTotalSpend { get; set; }
        public decimal DiscountPercent { get; set; }
    }
}