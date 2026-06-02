namespace HuongVanTra.Service.Users {
    public interface IUserAccountService {
        Task<UserAccountResult> CreateUserAsync(CreateUserRequest request);
        Task<UserAccountResult> ChangePasswordAsync(int id, ChangeUserPasswordRequest request);
        Task<UserAccountResult> ChangeMyPasswordAsync(int currentUserId, ChangeMyPasswordRequest request);
        Task<UserAccountResult> ChangeStatusAsync(int id, ChangeUserStatusRequest request);
    }
}
