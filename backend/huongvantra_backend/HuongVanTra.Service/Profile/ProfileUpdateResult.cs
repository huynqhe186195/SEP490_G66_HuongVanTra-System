namespace HuongVanTra.Service.Profile {
    public class ProfileUpdateResult {
        public bool Success { get; set; }
        public string? ErrorMessage { get; set; }
        public ProfileDto? Profile { get; set; }

        public static ProfileUpdateResult Ok(ProfileDto profile) => new() {
            Success = true,
            Profile = profile,
        };

        public static ProfileUpdateResult Fail(string message) => new() {
            Success = false,
            ErrorMessage = message,
        };
    }
}
