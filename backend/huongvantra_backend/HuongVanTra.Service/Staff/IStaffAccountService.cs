using HuongVanTra.Service.Orders;

namespace HuongVanTra.Service.Staff {
    public interface IStaffAccountService {
        Task<PagedResult<StaffAccountListItemDto>> GetAccountsAsync(
            StaffAccountQuery query,
            CancellationToken cancellationToken = default);

        Task<StaffAccountDetailDto?> GetAccountAsync(int userId, CancellationToken cancellationToken = default);

        Task<StaffAccountUpdateResult> UpdateAccountAsync(
            int userId,
            UpdateStaffAccountDto request,
            CancellationToken cancellationToken = default);

        Task<StaffAccountUpdateResult> AssignRolesAsync(
            int userId,
            AssignStaffRolesDto request,
            CancellationToken cancellationToken = default);

        Task<StaffAccountUpdateResult> CreateAccountAsync(
            CreateStaffAccountDto request,
            CancellationToken cancellationToken = default);

        Task<List<RoleOptionDto>> GetRoleOptionsAsync(CancellationToken cancellationToken = default);
    }
}
