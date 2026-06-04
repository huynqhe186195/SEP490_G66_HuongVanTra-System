namespace HuongVanTra.Service.DTOs.Inventory {
    public class StockResponseDto {
        public int ProductId { get; set; }
        public string Sku { get; set; } = null!;
        public string ProductName { get; set; } = null!;
        public decimal Quantity { get; set; }
    }
}