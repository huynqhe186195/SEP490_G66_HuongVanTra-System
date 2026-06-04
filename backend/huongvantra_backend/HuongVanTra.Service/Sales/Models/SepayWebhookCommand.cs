namespace HuongVanTra.Service.Sales {
    public class SepayWebhookCommand {
        public long TransactionId { get; set; }
        public string? Gateway { get; set; }
        public string? AccountNumber { get; set; }
        /// <summary>Số VA (BIDV) khách chuyển vào — field subAccount từ SePay.</summary>
        public string? SubAccount { get; set; }
        public string? TransferType { get; set; }
        public decimal TransferAmount { get; set; }
        public string? Content { get; set; }
        public string? ReferenceCode { get; set; }
        public string? TransactionDate { get; set; }
        /// <summary>Mã giao dịch ngân hàng (FT code).</summary>
        public string? Code { get; set; }
    }

    public class WebhookProcessResult {
        public bool Success { get; set; }
        public string Message { get; set; } = "";
        public int? OrderId { get; set; }
        public string? OrderCode { get; set; }
        public string? InvoiceCode { get; set; }
        public bool Skipped { get; set; }
    }
}
