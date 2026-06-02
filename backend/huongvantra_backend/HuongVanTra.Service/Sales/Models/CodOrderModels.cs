namespace HuongVanTra.Service.Sales.Models {
    public class CodDeliveredResult {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public string PaymentStatus { get; set; } = null!;
        public string OrderStatus { get; set; } = null!;
        public DateTime ConfirmedAt { get; set; }
    }

    public class OverdueCodOrderResult {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public decimal TotalAmount { get; set; }
        public string PaymentStatus { get; set; } = null!;
        public string OrderStatus { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
        public DateTime? LastRemindedAt { get; set; }
        public int DaysPending { get; set; }
    }

    public class CodRemindedResult {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public DateTime RemindedAt { get; set; }
    }

    public class VietQrPaidResult {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public string PaymentStatus { get; set; } = null!;
        public DateTime ConfirmedAt { get; set; }
    }
}
