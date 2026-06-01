using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HuongVanTra.Service.Profile {
    public class ProfileService : IProfileService {
        private readonly AppDbContext _dbContext;
        private readonly IPasswordHasher<User> _passwordHasher;

        public ProfileService(AppDbContext dbContext, IPasswordHasher<User> passwordHasher) {
            _dbContext = dbContext;
            _passwordHasher = passwordHasher;
        }

        public async Task<ProfileDto?> GetProfileAsync(int userId, CancellationToken cancellationToken = default) {
            var user = await QueryProfileUser(userId, cancellationToken);
            return user is null ? null : MapProfile(user);
        }

        public async Task<ProfileUpdateResult> UpdateProfileAsync(int userId, UpdateProfileDto request, CancellationToken cancellationToken = default) {
            var user = await _dbContext.Users
                .Include(u => u.Employee)
                    .ThenInclude(e => e.EmployeeRoles)
                        .ThenInclude(er => er.Role)
                .Include(u => u.Employee)
                    .ThenInclude(e => e.Store)
                .Include(u => u.Employee)
                    .ThenInclude(e => e.Department)
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive == 1, cancellationToken);

            if (user?.Employee is null) {
                return ProfileUpdateResult.Fail("User not found.");
            }

            if (!string.IsNullOrWhiteSpace(request.FullName)) {
                var fullName = request.FullName.Trim();
                if (fullName.Length > 150) {
                    return ProfileUpdateResult.Fail("Full name must be at most 150 characters.");
                }

                user.Employee.FullName = fullName;
            }

            if (request.Phone is not null) {
                var phone = request.Phone.Trim();
                if (phone.Length > 20) {
                    return ProfileUpdateResult.Fail("Phone must be at most 20 characters.");
                }

                user.Employee.Phone = string.IsNullOrEmpty(phone) ? null : phone;
            }

            if (request.Note is not null) {
                var note = request.Note.Trim();
                if (note.Length > 500) {
                    return ProfileUpdateResult.Fail("Note must be at most 500 characters.");
                }

                user.Employee.Notes = string.IsNullOrEmpty(note) ? null : note;
            }

            if (!string.IsNullOrWhiteSpace(request.Username)) {
                var username = request.Username.Trim();
                if (username.Length < 3 || username.Length > 50) {
                    return ProfileUpdateResult.Fail("Username must be between 3 and 50 characters.");
                }

                var usernameTaken = await _dbContext.Users
                    .AnyAsync(u => u.Id != userId && u.Username == username, cancellationToken);

                if (usernameTaken) {
                    return ProfileUpdateResult.Fail("Username is already taken.");
                }

                user.Username = username;
            }

            if (!string.IsNullOrWhiteSpace(request.NewPassword)) {
                if (request.NewPassword.Length < 6) {
                    return ProfileUpdateResult.Fail("New password must be at least 6 characters.");
                }

                if (string.IsNullOrWhiteSpace(request.CurrentPassword)) {
                    return ProfileUpdateResult.Fail("Current password is required to set a new password.");
                }

                if (!VerifyPassword(user, request.CurrentPassword)) {
                    return ProfileUpdateResult.Fail("Current password is incorrect.");
                }

                user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
            }

            await _dbContext.SaveChangesAsync(cancellationToken);

            var refreshed = await QueryProfileUser(userId, cancellationToken);
            return refreshed is null
                ? ProfileUpdateResult.Fail("User not found after update.")
                : ProfileUpdateResult.Ok(MapProfile(refreshed));
        }

        private IQueryable<User> ProfileUsersQuery() {
            return _dbContext.Users
                .AsNoTracking()
                .Include(u => u.Employee)
                    .ThenInclude(e => e.EmployeeRoles)
                        .ThenInclude(er => er.Role)
                .Include(u => u.Employee)
                    .ThenInclude(e => e.Store)
                .Include(u => u.Employee)
                    .ThenInclude(e => e.Department);
        }

        private Task<User?> QueryProfileUser(int userId, CancellationToken cancellationToken) {
            return ProfileUsersQuery()
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive == 1, cancellationToken);
        }

        private static ProfileDto MapProfile(User user) {
            var employee = user.Employee!;
            return new ProfileDto {
                UserId = user.Id,
                EmployeeId = employee.Id,
                EmployeeCode = employee.EmployeeCode,
                FullName = employee.FullName,
                Username = user.Username,
                Phone = employee.Phone,
                Note = employee.Notes,
                StoreId = employee.StoreId,
                StoreName = employee.Store?.Name,
                DepartmentId = employee.DepartmentId,
                DepartmentName = employee.Department?.Name,
                LastLoginAtUtc = user.LastLoginAt,
                Roles = employee.EmployeeRoles
                    .Select(er => er.Role.Name)
                    .Where(role => !string.IsNullOrWhiteSpace(role))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList(),
            };
        }

        private bool VerifyPassword(User user, string password) {
            try {
                var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password);
                if (verification != PasswordVerificationResult.Failed) {
                    return true;
                }
            }
            catch {
                // fall through to legacy plaintext check
            }

            return string.Equals(user.PasswordHash, password, StringComparison.Ordinal);
        }
    }
}
