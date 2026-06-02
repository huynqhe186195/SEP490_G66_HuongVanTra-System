namespace HuongVanTra.Service.Users {
    public class ChangeMyPasswordRequest {
        public string? CurrentPassword { get; set; }
        public string? NewPassword { get; set; }
        public string? ConfirmPassword { get; set; }
    }
}
