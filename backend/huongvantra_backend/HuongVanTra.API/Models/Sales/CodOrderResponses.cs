namespace HuongVanTra.API.Models.Sales {
    public class CodDeliveredResponse {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public string PaymentStatus { get; set; } = null!;
        public string OrderStatus { get; set; } = null!;
        public DateTime ConfirmedAt { get; set; }
    }

    public class OverdueCodOrderResponse {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public decimal TotalAmount { get; set; }
        public string PaymentStatus { get; set; } = null!;
        public string OrderStatus { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
        public DateTime? LastRemindedAt { get; set; }
        public int DaysPending { get; set; }
    }
}
