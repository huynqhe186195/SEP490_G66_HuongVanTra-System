namespace HuongVanTra.Service.Users {
    public class UserAccountResult {
        public UserAccountResponse? UserAccount { get; set; }
        public string? ErrorMessage { get; set; }

        public bool IsSuccess => UserAccount is not null && string.IsNullOrWhiteSpace(ErrorMessage);

        public static UserAccountResult Success(UserAccountResponse userAccount) {
            return new UserAccountResult { UserAccount = userAccount };
        }

        public static UserAccountResult Failure(string errorMessage) {
            return new UserAccountResult { ErrorMessage = errorMessage };
        }
    }
}
