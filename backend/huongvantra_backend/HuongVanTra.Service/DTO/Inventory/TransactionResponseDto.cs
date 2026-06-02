namespace HuongVanTra.Service.DTOs.Inventory {
    public class TransactionResponseDto {
        public string TxnCode { get; set; } = null!;
        public string TxnType { get; set; } = null!;
        public string ProductName { get; set; } = null!;
        public decimal QuantityBefore { get; set; }
        public decimal Quantity { get; set; }
        public decimal QuantityAfter { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}