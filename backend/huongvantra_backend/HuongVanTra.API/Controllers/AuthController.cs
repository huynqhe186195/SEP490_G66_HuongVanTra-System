using HuongVanTra.API.Extensions;
using HuongVanTra.API.Models.Auth;
using HuongVanTra.Service.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService) {
            _authService = authService;
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request) {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password)) {
                return BadRequest("Username and password are required.");
            }

            var result = await _authService.LoginAsync(request.Username, request.Password);
            if (result is null) {
                return Unauthorized("Invalid username or password.");
            }

            return Ok(new LoginResponse {
                AccessToken = result.AccessToken,
                RefreshToken = result.RefreshToken,
                Username = result.Username,
                Roles = result.Roles,
                ExpiresAtUtc = result.ExpiresAtUtc,
                RefreshTokenExpiresAtUtc = result.RefreshTokenExpiresAtUtc
            });
        }

        [AllowAnonymous]
        [HttpPost("refresh")]
        public async Task<ActionResult<LoginResponse>> Refresh([FromBody] RefreshTokenRequest request) {
            if (string.IsNullOrWhiteSpace(request.AccessToken) || string.IsNullOrWhiteSpace(request.RefreshToken)) {
                return BadRequest("Access token and refresh token are required.");
            }

            var result = await _authService.RefreshAsync(request.AccessToken, request.RefreshToken);
            if (result is null) {
                return Unauthorized("Invalid token.");
            }

            return Ok(new LoginResponse {
                AccessToken = result.AccessToken,
                RefreshToken = result.RefreshToken,
                Username = result.Username,
                Roles = result.Roles,
                ExpiresAtUtc = result.ExpiresAtUtc,
                RefreshTokenExpiresAtUtc = result.RefreshTokenExpiresAtUtc
            });
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout([FromBody] LogoutRequest request) {
            if (string.IsNullOrWhiteSpace(request.RefreshToken)) {
                return BadRequest("Refresh token is required.");
            }

            var userId = User.GetUserId();
            if (userId is null) {
                return Unauthorized("Invalid token subject.");
            }

            var isSuccess = await _authService.LogoutAsync(request.RefreshToken, userId.Value);
            if (!isSuccess) {
                return Unauthorized("Invalid token.");
            }

            return Ok("Logged out successfully.");
        }

        [HttpGet("me")]
        public async Task<ActionResult<CurrentUserResponse>> Me() {
            var userId = User.GetUserId();
            if (userId is null) {
                return Unauthorized("Invalid token subject.");
            }

            var currentUser = await _authService.GetCurrentUserAsync(userId.Value);
            if (currentUser is null) {
                return NotFound("User not found.");
            }

            return Ok(new CurrentUserResponse {
                UserId = currentUser.UserId,
                Username = currentUser.Username,
                EmployeeId = currentUser.EmployeeId,
                IsActive = currentUser.IsActive,
                LastLoginAtUtc = currentUser.LastLoginAtUtc,
                Roles = currentUser.Roles
            });
        }
    }
}
