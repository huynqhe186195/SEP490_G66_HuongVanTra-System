namespace HuongVanTra.Core.Entities.Stores {
    public class StoreSetting {
        public int Id { get; set; }
        public int StoreId { get; set; }

        public string? OpeningHours { get; set; }
        public string? TaxCode { get; set; }
        public string? WifiPassword { get; set; }

        public Store Store { get; set; } = null!;
    }
}