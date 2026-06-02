namespace HuongVanTra.API.Models.Sales {
    public class PosProductSearchItemResponse {
        public int ProductId { get; set; }
        public string Sku { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public decimal StockQuantity { get; set; }
    }
}
