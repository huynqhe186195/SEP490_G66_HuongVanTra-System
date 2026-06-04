using HuongVanTra.API.Models.Staff;
using HuongVanTra.Core.Authorization;
using HuongVanTra.Service.Orders;
using HuongVanTra.Service.Staff;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    /// <summary>
    /// Admin/staff management: list accounts, edit profile, assign roles.
    /// </summary>
    [Authorize(Policy = AppPolicies.ManageStaff)]
    [Route("api/staff-accounts")]
    public class StaffAccountsController : ApiControllerBase {
        private readonly IStaffAccountService _staffAccountService;

        public StaffAccountsController(IStaffAccountService staffAccountService) {
            _staffAccountService = staffAccountService;
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<StaffAccountListItemResponse>>> GetAccounts(
            [FromQuery] string? search,
            [FromQuery] string? role,
            [FromQuery] bool? isActive,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            CancellationToken cancellationToken = default) {
            var result = await _staffAccountService.GetAccountsAsync(new StaffAccountQuery {
                Search = search,
                Role = role,
                IsActive = isActive,
                Page = page,
                PageSize = pageSize,
            }, cancellationToken);

            return Ok(new PagedResult<StaffAccountListItemResponse> {
                Items = result.Items.Select(MapListItem).ToList(),
                TotalCount = result.TotalCount,
                Page = result.Page,
                PageSize = result.PageSize,
            });
        }

        [HttpGet("roles")]
        public async Task<ActionResult<List<RoleOptionResponse>>> GetRoleOptions(CancellationToken cancellationToken) {
            var roles = await _staffAccountService.GetRoleOptionsAsync(cancellationToken);
            return Ok(roles.Select(r => new RoleOptionResponse {
                Id = r.Id,
                Name = r.Name,
            }).ToList());
        }

        [HttpGet("{userId:int}")]
        public async Task<ActionResult<StaffAccountDetailResponse>> GetAccount(
            int userId,
            CancellationToken cancellationToken) {
            var account = await _staffAccountService.GetAccountAsync(userId, cancellationToken);
            if (account is null) {
                return NotFound("Tài khoản không tồn tại.");
            }

            return Ok(MapDetail(account));
        }

        [HttpPost]
        public async Task<ActionResult<StaffAccountDetailResponse>> CreateAccount(
            [FromBody] CreateStaffAccountRequest request,
            CancellationToken cancellationToken) {
            var result = await _staffAccountService.CreateAccountAsync(new CreateStaffAccountDto {
                FullName = request.FullName,
                Username = request.Username,
                Password = request.Password,
                Phone = request.Phone,
                Note = request.Note,
                IsActive = request.IsActive,
                StoreId = request.StoreId,
                DepartmentId = request.DepartmentId,
                Roles = request.Roles,
            }, cancellationToken);

            if (!result.Success) {
                return BadRequest(result.ErrorMessage);
            }

            return CreatedAtAction(
                nameof(GetAccount),
                new { userId = result.Account!.UserId },
                MapDetail(result.Account));
        }

        [HttpPut("{userId:int}")]
        public async Task<ActionResult<StaffAccountDetailResponse>> UpdateAccount(
            int userId,
            [FromBody] UpdateStaffAccountRequest request,
            CancellationToken cancellationToken) {
            var result = await _staffAccountService.UpdateAccountAsync(userId, new UpdateStaffAccountDto {
                FullName = request.FullName,
                Phone = request.Phone,
                Note = request.Note,
                Username = request.Username,
                IsActive = request.IsActive,
                NewPassword = request.NewPassword,
            }, cancellationToken);

            if (!result.Success) {
                return BadRequest(result.ErrorMessage);
            }

            return Ok(MapDetail(result.Account!));
        }

        [HttpPut("{userId:int}/roles")]
        public async Task<ActionResult<StaffAccountDetailResponse>> AssignRoles(
            int userId,
            [FromBody] AssignStaffRolesRequest request,
            CancellationToken cancellationToken) {
            var result = await _staffAccountService.AssignRolesAsync(userId, new AssignStaffRolesDto {
                Roles = request.Roles,
            }, cancellationToken);

            if (!result.Success) {
                return BadRequest(result.ErrorMessage);
            }

            return Ok(MapDetail(result.Account!));
        }

        private static StaffAccountListItemResponse MapListItem(StaffAccountListItemDto dto) {
            return new StaffAccountListItemResponse {
                UserId = dto.UserId,
                EmployeeId = dto.EmployeeId,
                EmployeeCode = dto.EmployeeCode,
                FullName = dto.FullName,
                Username = dto.Username,
                Phone = dto.Phone,
                IsActive = dto.IsActive,
                EmployeeStatus = dto.EmployeeStatus,
                StoreId = dto.StoreId,
                StoreName = dto.StoreName,
                Roles = dto.Roles,
                LastLoginAtUtc = dto.LastLoginAtUtc,
            };
        }

        private static StaffAccountDetailResponse MapDetail(StaffAccountDetailDto dto) {
            var list = MapListItem(dto);
            return new StaffAccountDetailResponse {
                UserId = list.UserId,
                EmployeeId = list.EmployeeId,
                EmployeeCode = list.EmployeeCode,
                FullName = list.FullName,
                Username = list.Username,
                Phone = list.Phone,
                IsActive = list.IsActive,
                EmployeeStatus = list.EmployeeStatus,
                StoreId = list.StoreId,
                StoreName = list.StoreName,
                Roles = list.Roles,
                LastLoginAtUtc = list.LastLoginAtUtc,
                Note = dto.Note,
                DepartmentId = dto.DepartmentId,
                DepartmentName = dto.DepartmentName,
            };
        }
    }
}
