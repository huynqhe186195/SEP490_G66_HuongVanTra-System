namespace HuongVanTra.Service.Admin {
    public interface IMembershipTierAdminService {
        Task<IReadOnlyList<MembershipTierAdminItemDto>> ListAsync(CancellationToken cancellationToken = default);
        Task<MembershipTierAdminItemDto?> GetAsync(int id, CancellationToken cancellationToken = default);
        Task<MembershipTierAdminItemDto> CreateAsync(UpsertMembershipTierRequest request, CancellationToken cancellationToken = default);
        Task<MembershipTierAdminItemDto?> UpdateAsync(int id, UpsertMembershipTierRequest request, CancellationToken cancellationToken = default);
        Task DeleteAsync(int id, CancellationToken cancellationToken = default);
    }
}
