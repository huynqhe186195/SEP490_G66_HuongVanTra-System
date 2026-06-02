using HuongVanTra.Service.DTO.Customers;
using HuongVanTra.Service.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Route("api/[controller]")]
    [ApiController]
    public class CustomerController : ControllerBase {
        private readonly ICustomerService _customerService;

        public CustomerController(ICustomerService customerService) {
            _customerService = customerService;
        }

        // get: get membership tiers
        [HttpGet("tiers")]
        public async Task<IActionResult> GetMembershipTiers() {
            try {
                var tiers = await _customerService.GetMembershipTiersAsync();
                return Ok(tiers);
            }
            catch (Exception ex) {
                return BadRequest(new { message = ex.Message });
            }
        }

        // put: upgrade membership tier manually
        [HttpPut("upgrade-tier")]
        public async Task<IActionResult> UpgradeCustomerTier([FromBody] UpgradeTierRequestDto dto) {
            try {
                await _customerService.UpgradeTierManuallyAsync(dto);
                return Ok(new { message = "Cập nhật hạng thành viên thành công!" });
            }
            catch (Exception ex) {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}