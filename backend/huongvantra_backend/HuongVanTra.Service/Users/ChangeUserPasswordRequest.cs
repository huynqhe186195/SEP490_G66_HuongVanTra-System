namespace HuongVanTra.Service.Users {
    public class ChangeUserPasswordRequest {
        public string? NewPassword { get; set; }
        public string? ConfirmPassword { get; set; }
    }
}
