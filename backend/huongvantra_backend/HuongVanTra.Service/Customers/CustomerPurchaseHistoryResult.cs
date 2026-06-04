namespace HuongVanTra.Service.Customers {
    public class CustomerPurchaseHistoryResult {
        public CustomerPurchaseHistoryResponse? PurchaseHistory { get; set; }
        public string? ErrorMessage { get; set; }
        public bool IsForbidden { get; set; }

        public bool IsSuccess => PurchaseHistory is not null && string.IsNullOrWhiteSpace(ErrorMessage) && !IsForbidden;

        public static CustomerPurchaseHistoryResult Success(CustomerPurchaseHistoryResponse purchaseHistory) {
            return new CustomerPurchaseHistoryResult { PurchaseHistory = purchaseHistory };
        }

        public static CustomerPurchaseHistoryResult Failure(string errorMessage) {
            return new CustomerPurchaseHistoryResult { ErrorMessage = errorMessage };
        }

        public static CustomerPurchaseHistoryResult Forbidden(string errorMessage) {
            return new CustomerPurchaseHistoryResult { ErrorMessage = errorMessage, IsForbidden = true };
        }
    }
}
