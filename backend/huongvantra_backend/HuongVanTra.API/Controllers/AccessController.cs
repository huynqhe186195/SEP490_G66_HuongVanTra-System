using HuongVanTra.API.Extensions;
using HuongVanTra.API.Models.Auth;
using HuongVanTra.Core.Authorization;
using HuongVanTra.Service.Auth;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Route("api/[controller]")]
    public class AccessController : ApiControllerBase {
        private readonly IAuthService _authService;

        public AccessController(IAuthService authService) {
            _authService = authService;
        }

        /// <summary>
        /// Returns roles and module permissions for the current user (for frontend menu/guards).
        /// </summary>
        [HttpGet("me")]
        public async Task<ActionResult<UserAccessResponse>> GetCurrentAccess() {
            var userId = User.GetUserId();
            if (userId is null) {
                return Unauthorized();
            }

            var currentUser = await _authService.GetCurrentUserAsync(userId.Value);
            if (currentUser is null) {
                return NotFound("User not found.");
            }

            return Ok(new UserAccessResponse {
                UserId = currentUser.UserId,
                Username = currentUser.Username,
                Roles = currentUser.Roles,
                Modules = RolePermissions.GetModulesForRoles(currentUser.Roles).ToList(),
            });
        }
    }
}
