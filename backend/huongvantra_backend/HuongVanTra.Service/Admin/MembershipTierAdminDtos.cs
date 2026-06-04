namespace HuongVanTra.Service.Admin {
    public class MembershipTierAdminItemDto {
        public int Id { get; set; }
        public string TierCode { get; set; } = string.Empty;
        public decimal MinTotalSpend { get; set; }
        public decimal DiscountPercent { get; set; }
        public int CustomerCount { get; set; }
    }

    public class UpsertMembershipTierRequest {
        public string TierCode { get; set; } = string.Empty;
        public decimal MinTotalSpend { get; set; }
        public decimal DiscountPercent { get; set; }
    }
}
