using HuongVanTra.API.Extensions;
using HuongVanTra.Core.Authorization;
using HuongVanTra.Service.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ApiControllerBase {
        private readonly IUserAccountService _userAccountService;

        public UsersController(IUserAccountService userAccountService) {
            _userAccountService = userAccountService;
        }

        [HttpPost]
        [Authorize(Policy = AppPolicies.ManageStaff)]
        public async Task<ActionResult<UserAccountResponse>> CreateUser([FromBody] CreateUserRequest request) {
            if (string.IsNullOrWhiteSpace(request.Username)) {
                return BadRequest("Username is required.");
            }

            if (string.IsNullOrWhiteSpace(request.Password)) {
                return BadRequest("Password is required.");
            }

            var result = await _userAccountService.CreateUserAsync(request);
            if (result.IsSuccess && result.UserAccount is not null) {
                return CreatedAtAction(nameof(CreateUser), new { id = result.UserAccount.UserId }, result.UserAccount);
            }

            return BadRequest(result.ErrorMessage);
        }

        [HttpPut("{id:int}/password")]
        [Authorize(Policy = AppPolicies.ManageStaff)]
        public async Task<ActionResult<UserAccountResponse>> ChangePassword(int id, [FromBody] ChangeUserPasswordRequest request) {
            if (string.IsNullOrWhiteSpace(request.NewPassword)) {
                return BadRequest("NewPassword is required.");
            }

            if (!string.Equals(request.NewPassword, request.ConfirmPassword, StringComparison.Ordinal)) {
                return BadRequest("ConfirmPassword must match NewPassword.");
            }

            var result = await _userAccountService.ChangePasswordAsync(id, request);
            if (result.IsSuccess && result.UserAccount is not null) {
                return Ok(result.UserAccount);
            }

            return NotFound(result.ErrorMessage);
        }

        [HttpPut("me/password")]
        public async Task<ActionResult<UserAccountResponse>> ChangeMyPassword([FromBody] ChangeMyPasswordRequest request) {
            var currentUserId = User.GetUserId();
            if (currentUserId is null) {
                return Unauthorized("Invalid token subject.");
            }

            if (string.IsNullOrWhiteSpace(request.CurrentPassword)) {
                return BadRequest("CurrentPassword is required.");
            }

            if (string.IsNullOrWhiteSpace(request.NewPassword)) {
                return BadRequest("NewPassword is required.");
            }

            if (!string.Equals(request.NewPassword, request.ConfirmPassword, StringComparison.Ordinal)) {
                return BadRequest("ConfirmPassword must match NewPassword.");
            }

            var result = await _userAccountService.ChangeMyPasswordAsync(currentUserId.Value, request);
            if (result.IsSuccess && result.UserAccount is not null) {
                return Ok(result.UserAccount);
            }

            if (string.Equals(result.ErrorMessage, "User not found.", StringComparison.Ordinal)) {
                return NotFound(result.ErrorMessage);
            }

            return BadRequest(result.ErrorMessage);
        }

        [HttpPatch("{id:int}/status")]
        [Authorize(Policy = AppPolicies.ManageStaff)]
        public async Task<ActionResult<UserAccountResponse>> ChangeStatus(int id, [FromBody] ChangeUserStatusRequest request) {
            var result = await _userAccountService.ChangeStatusAsync(id, request);
            if (result.IsSuccess && result.UserAccount is not null) {
                return Ok(result.UserAccount);
            }

            return NotFound(result.ErrorMessage);
        }
    }
}
