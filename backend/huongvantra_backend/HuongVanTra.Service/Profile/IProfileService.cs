namespace HuongVanTra.Service.Profile {
    public interface IProfileService {
        Task<ProfileDto?> GetProfileAsync(int userId, CancellationToken cancellationToken = default);
        Task<ProfileUpdateResult> UpdateProfileAsync(int userId, UpdateProfileDto request, CancellationToken cancellationToken = default);
    }
}
