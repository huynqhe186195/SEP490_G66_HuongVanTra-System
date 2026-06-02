using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HuongVanTra.Service.Users {
    public class UserAccountService : IUserAccountService {
        private readonly AppDbContext _dbContext;

        public UserAccountService(AppDbContext dbContext) {
            _dbContext = dbContext;
        }

        public async Task<UserAccountResult> CreateUserAsync(CreateUserRequest request) {
            var employee = await _dbContext.Set<Employee>()
                .Include(e => e.User)
                .Include(e => e.EmployeeRoles)
                    .ThenInclude(er => er.Role)
                .FirstOrDefaultAsync(e => e.Id == request.EmployeeId);

            if (employee is null) {
                return UserAccountResult.Failure("Employee not found.");
            }

            if (employee.User is not null) {
                return UserAccountResult.Failure("Employee already has a user account.");
            }

            var username = request.Username!.Trim();
            if (await _dbContext.Users.AnyAsync(u => u.Username == username)) {
                return UserAccountResult.Failure("Username already exists.");
            }

            var roleIds = request.RoleIds?
                .Distinct()
                .ToList() ?? new List<int>();

            if (roleIds.Count > 0) {
                var existingRoleIds = await _dbContext.Roles
                    .Where(r => roleIds.Contains(r.Id))
                    .Select(r => r.Id)
                    .ToListAsync();

                var missingRoleIds = roleIds.Except(existingRoleIds).ToList();
                if (missingRoleIds.Count > 0) {
                    return UserAccountResult.Failure("One or more roles were not found.");
                }
            }

            var user = new User {
                EmployeeId = employee.Id,
                Username = username,
                PasswordHash = request.Password!,
                IsActive = 1
            };

            _dbContext.Users.Add(user);

            if (roleIds.Count > 0) {
                var existingAssignments = await _dbContext.Set<EmployeeRole>()
                    .Where(er => er.EmployeeId == employee.Id && er.StoreId == employee.StoreId)
                    .Select(er => er.RoleId)
                    .ToListAsync();

                foreach (var roleId in roleIds.Except(existingAssignments)) {
                    _dbContext.Set<EmployeeRole>().Add(new EmployeeRole {
                        EmployeeId = employee.Id,
                        RoleId = roleId,
                        StoreId = employee.StoreId
                    });
                }
            }

            await _dbContext.SaveChangesAsync();

            var createdUser = await GetUserWithEmployeeAsync(user.Id);
            return UserAccountResult.Success(MapResponse(createdUser!));
        }

        public async Task<UserAccountResult> ChangePasswordAsync(int id, ChangeUserPasswordRequest request) {
            var user = await GetUserWithEmployeeAsync(id, tracking: true);
            if (user is null) {
                return UserAccountResult.Failure("User not found.");
            }

            user.PasswordHash = request.NewPassword!;
            await _dbContext.SaveChangesAsync();

            return UserAccountResult.Success(MapResponse(user));
        }

        public async Task<UserAccountResult> ChangeMyPasswordAsync(int currentUserId, ChangeMyPasswordRequest request) {
            var user = await GetUserWithEmployeeAsync(currentUserId, tracking: true);
            if (user is null) {
                return UserAccountResult.Failure("User not found.");
            }

            if (!string.Equals(user.PasswordHash, request.CurrentPassword, StringComparison.Ordinal)) {
                return UserAccountResult.Failure("Current password is incorrect.");
            }

            if (string.Equals(user.PasswordHash, request.NewPassword, StringComparison.Ordinal)) {
                return UserAccountResult.Failure("New password must be different from current password.");
            }

            user.PasswordHash = request.NewPassword!;
            await _dbContext.SaveChangesAsync();

            return UserAccountResult.Success(MapResponse(user));
        }

        public async Task<UserAccountResult> ChangeStatusAsync(int id, ChangeUserStatusRequest request) {
            var user = await GetUserWithEmployeeAsync(id, tracking: true);
            if (user is null) {
                return UserAccountResult.Failure("User not found.");
            }

            user.IsActive = request.IsActive ? (byte)1 : (byte)0;
            await _dbContext.SaveChangesAsync();

            return UserAccountResult.Success(MapResponse(user));
        }

        private async Task<User?> GetUserWithEmployeeAsync(int id, bool tracking = false) {
            var query = _dbContext.Users
                .Include(u => u.Employee)
                    .ThenInclude(e => e.EmployeeRoles)
                        .ThenInclude(er => er.Role)
                .AsQueryable();

            if (!tracking) {
                query = query.AsNoTracking();
            }

            return await query.FirstOrDefaultAsync(u => u.Id == id);
        }

        private static UserAccountResponse MapResponse(User user) {
            return new UserAccountResponse {
                UserId = user.Id,
                EmployeeId = user.EmployeeId,
                EmployeeCode = user.Employee.EmployeeCode,
                FullName = user.Employee.FullName,
                Username = user.Username,
                IsActive = user.IsActive == 1,
                LastLoginAtUtc = user.LastLoginAt,
                Roles = user.Employee.EmployeeRoles
                    .Select(er => er.Role.Name)
                    .Where(role => !string.IsNullOrWhiteSpace(role))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList()
            };
        }
    }
}
