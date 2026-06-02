using HuongVanTra.Service.DTO.Customers;

namespace HuongVanTra.Service.Interfaces {
    public interface ICustomerService {
        Task<List<MembershipTierResponseDto>> GetMembershipTiersAsync();
        Task<bool> UpgradeTierManuallyAsync(UpgradeTierRequestDto dto);
    }
}