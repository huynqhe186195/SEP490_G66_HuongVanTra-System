using System.Text.Json.Serialization;

namespace HuongVanTra.API.Models.Sales {
    public class SepayWebhookPayload {
        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("gateway")]
        public string? Gateway { get; set; }

        [JsonPropertyName("transactionDate")]
        public string? TransactionDate { get; set; }

        [JsonPropertyName("accountNumber")]
        public string? AccountNumber { get; set; }

        [JsonPropertyName("subAccount")]
        public string? SubAccount { get; set; }

        /// <summary>"in" = tiền vào, "out" = tiền ra.</summary>
        [JsonPropertyName("transferType")]
        public string? TransferType { get; set; }

        [JsonPropertyName("transferAmount")]
        public decimal TransferAmount { get; set; }

        [JsonPropertyName("accumulated")]
        public decimal Accumulated { get; set; }

        /// <summary>Mã giao dịch ngân hàng.</summary>
        [JsonPropertyName("code")]
        public string? Code { get; set; }

        /// <summary>Nội dung chuyển khoản — dùng để match order_code.</summary>
        [JsonPropertyName("content")]
        public string? Content { get; set; }

        [JsonPropertyName("referenceCode")]
        public string? ReferenceCode { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }
    }
}
