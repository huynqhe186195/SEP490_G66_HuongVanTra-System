namespace HuongVanTra.API.Models.Sales {
    public class PreviewStockDeductResponse {
        public int QueueId { get; set; }
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public string QueueStatus { get; set; } = null!;
        public string OrderStockStatus { get; set; } = null!;
        public bool CanDeduct { get; set; }
        public List<PreviewStockDeductItemResponse> Items { get; set; } = new();
    }

    public class PreviewStockDeductItemResponse {
        public int ProductId { get; set; }
        public int MaterialId { get; set; }
        public string? MaterialName { get; set; }
        public decimal RequiredQuantity { get; set; }
        public decimal AvailableQuantity { get; set; }
        public decimal ShortageQuantity { get; set; }
        public string Status { get; set; } = null!;
    }
}
