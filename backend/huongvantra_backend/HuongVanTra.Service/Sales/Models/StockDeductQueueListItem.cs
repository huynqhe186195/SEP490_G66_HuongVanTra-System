namespace HuongVanTra.Service.Sales.Models {
    public class StockDeductQueueListItem {
        public int QueueId { get; set; }
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public string QueueStatus { get; set; } = null!;
        public string OrderPaymentStatus { get; set; } = null!;
        public string OrderStockStatus { get; set; } = null!;
        public decimal TotalAmount { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
