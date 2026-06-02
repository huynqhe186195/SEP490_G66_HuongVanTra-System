namespace HuongVanTra.Service.Customers {
    public class CustomerResult {
        public CustomerDetailResponse? Customer { get; set; }
        public string? ErrorMessage { get; set; }
        public bool IsForbidden { get; set; }

        public bool IsSuccess => Customer is not null && string.IsNullOrWhiteSpace(ErrorMessage) && !IsForbidden;

        public static CustomerResult Success(CustomerDetailResponse customer) {
            return new CustomerResult { Customer = customer };
        }

        public static CustomerResult Failure(string errorMessage) {
            return new CustomerResult { ErrorMessage = errorMessage };
        }

        public static CustomerResult Forbidden(string errorMessage) {
            return new CustomerResult { ErrorMessage = errorMessage, IsForbidden = true };
        }
    }
}
