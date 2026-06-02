using HuongVanTra.Service.DTO.Customers;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace HuongVanTra.Service.Interfaces {
    public interface ICustomerService {
        Task<List<MembershipTierResponseDto>> GetMembershipTiersAsync();
        Task<bool> UpgradeTierManuallyAsync(UpgradeTierRequestDto dto);
    }
}