namespace HuongVanTra.API.Models.Sales {
    public class ConfirmStockDeductResponse {
        public int QueueId { get; set; }
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public string QueueStatus { get; set; } = null!;
        public string OrderStockStatus { get; set; } = null!;
        public DateTime ConfirmedAt { get; set; }
    }
}
