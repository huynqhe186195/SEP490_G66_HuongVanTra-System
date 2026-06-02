namespace HuongVanTra.API.Models.Sales {
    public class InsufficientStockResponse {
        public string Code { get; set; } = "INSUFFICIENT_STOCK";
        public string Message { get; set; } = "Không đủ tồn kho để trừ cho đơn hàng.";
        public int QueueId { get; set; }
        public int OrderId { get; set; }
        public string OrderStockStatus { get; set; } = null!;
        public List<ShortageItemResponse> Shortages { get; set; } = new();
    }

    public class ShortageItemResponse {
        public int ProductId { get; set; }
        public int MaterialId { get; set; }
        public decimal RequiredQuantity { get; set; }
        public decimal AvailableQuantity { get; set; }
        public decimal ShortageQuantity { get; set; }
    }
}
