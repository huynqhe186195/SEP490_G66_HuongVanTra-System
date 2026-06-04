namespace HuongVanTra.Service.Admin {
    public class PromotionAdminItemDto {
        public int Id { get; set; }
        public string PromoCode { get; set; } = string.Empty;
        public string DiscountType { get; set; } = string.Empty;
        public decimal DiscountValue { get; set; }
        public DateTime? ValidFromUtc { get; set; }
        public DateTime? ValidToUtc { get; set; }
        public string ValidityStatus { get; set; } = string.Empty;
        public int OrderCount { get; set; }
        public bool IsActive { get; set; }
    }

    public class UpsertPromotionRequest {
        public string PromoCode { get; set; } = string.Empty;
        public string DiscountType { get; set; } = "PERCENTAGE";
        public decimal DiscountValue { get; set; }
        public DateOnly? ValidFrom { get; set; }
        public DateOnly? ValidTo { get; set; }
    }
}
