using HuongVanTra.API.Extensions;
using HuongVanTra.API.Models.Profile;
using HuongVanTra.Service.Profile;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Route("api/[controller]")]
    public class ProfileController : ApiControllerBase {
        private readonly IProfileService _profileService;

        public ProfileController(IProfileService profileService) {
            _profileService = profileService;
        }

        [HttpGet("me")]
        public async Task<ActionResult<ProfileResponse>> GetMyProfile(CancellationToken cancellationToken) {
            var userId = User.GetUserId();
            if (userId is null) {
                return Unauthorized("Invalid token subject.");
            }

            var profile = await _profileService.GetProfileAsync(userId.Value, cancellationToken);
            if (profile is null) {
                return NotFound("Profile not found.");
            }

            return Ok(MapResponse(profile));
        }

        [HttpPut("me")]
        public async Task<ActionResult<ProfileResponse>> UpdateMyProfile(
            [FromBody] UpdateProfileRequest request,
            CancellationToken cancellationToken) {
            var userId = User.GetUserId();
            if (userId is null) {
                return Unauthorized("Invalid token subject.");
            }

            var result = await _profileService.UpdateProfileAsync(userId.Value, new UpdateProfileDto {
                FullName = request.FullName,
                Username = request.Username,
                Phone = request.Phone,
                Note = request.Note,
                CurrentPassword = request.CurrentPassword,
                NewPassword = request.NewPassword,
            }, cancellationToken);

            if (!result.Success) {
                return BadRequest(result.ErrorMessage);
            }

            return Ok(MapResponse(result.Profile!));
        }

        private static ProfileResponse MapResponse(ProfileDto profile) {
            return new ProfileResponse {
                UserId = profile.UserId,
                EmployeeId = profile.EmployeeId,
                EmployeeCode = profile.EmployeeCode,
                FullName = profile.FullName,
                Username = profile.Username,
                Phone = profile.Phone,
                Note = profile.Note,
                StoreId = profile.StoreId,
                StoreName = profile.StoreName,
                DepartmentId = profile.DepartmentId,
                DepartmentName = profile.DepartmentName,
                LastLoginAtUtc = profile.LastLoginAtUtc,
                Roles = profile.Roles,
            };
        }
    }
}
