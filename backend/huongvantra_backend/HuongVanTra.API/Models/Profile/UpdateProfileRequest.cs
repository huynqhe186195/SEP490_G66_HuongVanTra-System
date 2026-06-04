namespace HuongVanTra.API.Models.Profile {
    public class UpdateProfileRequest {
        public string? FullName { get; set; }
        public string? Username { get; set; }
        public string? Phone { get; set; }
        public string? Note { get; set; }
        public string? CurrentPassword { get; set; }
        public string? NewPassword { get; set; }
    }
}
