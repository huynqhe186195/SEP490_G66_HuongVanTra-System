namespace HuongVanTra.Service.Sales.Models {
    public class SepayOrderVaResult {
        public string SepayOrderId { get; set; } = "";
        public string OrderCode { get; set; } = "";
        public string VaNumber { get; set; } = "";
        public string? QrImageUrl { get; set; }
        public string? QrPayload { get; set; }
        public decimal Amount { get; set; }
        public string? BankName { get; set; }
        public string PaymentMode { get; set; } = "sepay_order_va";
    }
}
