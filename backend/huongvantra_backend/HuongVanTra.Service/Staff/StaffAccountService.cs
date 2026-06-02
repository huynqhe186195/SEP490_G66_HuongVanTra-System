using HuongVanTra.Core.Authorization;
using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Orders;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HuongVanTra.Service.Staff {
    public class StaffAccountService : IStaffAccountService {
        private readonly AppDbContext _dbContext;
        private readonly IPasswordHasher<User> _passwordHasher;

        public StaffAccountService(AppDbContext dbContext, IPasswordHasher<User> passwordHasher) {
            _dbContext = dbContext;
            _passwordHasher = passwordHasher;
        }

        public async Task<PagedResult<StaffAccountListItemDto>> GetAccountsAsync(
            StaffAccountQuery query,
            CancellationToken cancellationToken = default) {
            var page = query.Page < 1 ? 1 : query.Page;
            var pageSize = query.PageSize < 1 ? 20 : Math.Min(query.PageSize, 100);

            var accountsQuery = BaseAccountQuery();

            if (!string.IsNullOrWhiteSpace(query.Search)) {
                var term = query.Search.Trim();
                accountsQuery = accountsQuery.Where(u =>
                    u.Username.Contains(term) ||
                    u.Employee!.FullName.Contains(term) ||
                    u.Employee.EmployeeCode.Contains(term) ||
                    (u.Employee.Phone != null && u.Employee.Phone.Contains(term)));
            }

            if (!string.IsNullOrWhiteSpace(query.Role)) {
                var role = query.Role.Trim();
                accountsQuery = accountsQuery.Where(u =>
                    u.Employee!.EmployeeRoles.Any(er => er.Role.Name == role));
            }

            if (query.IsActive.HasValue) {
                var active = query.IsActive.Value ? (byte)1 : (byte)0;
                accountsQuery = accountsQuery.Where(u => u.IsActive == active);
            }

            var totalCount = await accountsQuery.CountAsync(cancellationToken);

            var users = await accountsQuery
                .OrderBy(u => u.Employee!.FullName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return new PagedResult<StaffAccountListItemDto> {
                Items = users.Select(MapListItem).ToList(),
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
            };
        }

        public async Task<StaffAccountDetailDto?> GetAccountAsync(int userId, CancellationToken cancellationToken = default) {
            var user = await BaseAccountQuery()
                .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

            return user is null ? null : MapDetail(user);
        }

        public async Task<StaffAccountUpdateResult> UpdateAccountAsync(
            int userId,
            UpdateStaffAccountDto request,
            CancellationToken cancellationToken = default) {
            var user = await _dbContext.Users
                .Include(u => u.Employee)
                    .ThenInclude(e => e.EmployeeRoles)
                        .ThenInclude(er => er.Role)
                .Include(u => u.Employee)
                    .ThenInclude(e => e.Store)
                .Include(u => u.Employee)
                    .ThenInclude(e => e.Department)
                .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

            if (user?.Employee is null) {
                return StaffAccountUpdateResult.Fail("Tài khoản không tồn tại.");
            }

            if (!string.IsNullOrWhiteSpace(request.FullName)) {
                var fullName = request.FullName.Trim();
                if (fullName.Length > 150) {
                    return StaffAccountUpdateResult.Fail("Họ tên tối đa 150 ký tự.");
                }

                user.Employee.FullName = fullName;
            }

            if (request.Phone is not null) {
                var phone = request.Phone.Trim();
                if (string.IsNullOrWhiteSpace(phone) || phone.Length > 20) {
                    return StaffAccountUpdateResult.Fail("Số điện thoại là bắt buộc và tối đa 20 ký tự.");
                }

                user.Employee.Phone = phone;
            }

            if (request.Note is not null) {
                var note = request.Note.Trim();
                if (note.Length > 500) {
                    return StaffAccountUpdateResult.Fail("Ghi chú tối đa 500 ký tự.");
                }

                user.Employee.Notes = string.IsNullOrEmpty(note) ? null : note;
            }

            if (!string.IsNullOrWhiteSpace(request.Username)) {
                var username = request.Username.Trim();
                if (username.Length < 3 || username.Length > 50) {
                    return StaffAccountUpdateResult.Fail("Tên đăng nhập phải từ 3–50 ký tự.");
                }

                var usernameTaken = await _dbContext.Users
                    .AnyAsync(u => u.Id != userId && u.Username == username, cancellationToken);

                if (usernameTaken) {
                    return StaffAccountUpdateResult.Fail("Tên đăng nhập đã được sử dụng.");
                }

                user.Username = username;
            }

            if (request.IsActive.HasValue) {
                user.IsActive = request.IsActive.Value ? (byte)1 : (byte)0;
                user.Employee.Status = request.IsActive.Value ? "ACTIVE" : "LOCKED";
            }

            if (!string.IsNullOrWhiteSpace(request.NewPassword)) {
                if (request.NewPassword.Length < 6) {
                    return StaffAccountUpdateResult.Fail("Mật khẩu mới phải có ít nhất 6 ký tự.");
                }

                user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            return StaffAccountUpdateResult.Ok(MapDetail(user));
        }

        public async Task<StaffAccountUpdateResult> AssignRolesAsync(
            int userId,
            AssignStaffRolesDto request,
            CancellationToken cancellationToken = default) {
            if (request.Roles is null || request.Roles.Count == 0) {
                return StaffAccountUpdateResult.Fail("Phải chọn ít nhất một vai trò.");
            }

            var normalizedRoleNames = request.Roles
                .Select(role => role.Trim())
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (normalizedRoleNames.Count == 0) {
                return StaffAccountUpdateResult.Fail("Phải chọn ít nhất một vai trò.");
            }

            var invalidRoles = normalizedRoleNames
                .Where(role => !AppRoles.All.Contains(role, StringComparer.OrdinalIgnoreCase))
                .ToList();

            if (invalidRoles.Count > 0) {
                return StaffAccountUpdateResult.Fail($"Vai trò không hợp lệ: {string.Join(", ", invalidRoles)}.");
            }

            var user = await _dbContext.Users
                .Include(u => u.Employee)
                    .ThenInclude(e => e.EmployeeRoles)
                .Include(u => u.Employee)
                    .ThenInclude(e => e.Store)
                .Include(u => u.Employee)
                    .ThenInclude(e => e.Department)
                .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

            if (user?.Employee is null) {
                return StaffAccountUpdateResult.Fail("Tài khoản không tồn tại.");
            }

            var rolesInDb = await _dbContext.Roles
                .Where(r => normalizedRoleNames.Contains(r.Name))
                .ToListAsync(cancellationToken);

            if (rolesInDb.Count != normalizedRoleNames.Count) {
                var missing = normalizedRoleNames
                    .Except(rolesInDb.Select(r => r.Name), StringComparer.OrdinalIgnoreCase);
                return StaffAccountUpdateResult.Fail(
                    $"Vai trò chưa được cấu hình trong hệ thống: {string.Join(", ", missing)}.");
            }

            var employee = user.Employee;
            var existingRoles = await _dbContext.Set<EmployeeRole>()
                .Where(er => er.EmployeeId == employee.Id)
                .ToListAsync(cancellationToken);

            _dbContext.Set<EmployeeRole>().RemoveRange(existingRoles);

            foreach (var role in rolesInDb) {
                _dbContext.Set<EmployeeRole>().Add(new EmployeeRole {
                    EmployeeId = employee.Id,
                    RoleId = role.Id,
                    StoreId = employee.StoreId,
                    AssignedAt = DateTime.UtcNow,
                });
            }

            await _dbContext.SaveChangesAsync(cancellationToken);

            await _dbContext.Entry(employee)
                .Collection(e => e.EmployeeRoles)
                .Query()
                .Include(er => er.Role)
                .LoadAsync(cancellationToken);

            return StaffAccountUpdateResult.Ok(MapDetail(user));
        }

        public async Task<StaffAccountUpdateResult> CreateAccountAsync(
            CreateStaffAccountDto request,
            CancellationToken cancellationToken = default) {
            var fullName = request.FullName?.Trim() ?? string.Empty;
            var username = request.Username?.Trim() ?? string.Empty;
            var password = request.Password ?? string.Empty;
            var phone = request.Phone?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(fullName) || fullName.Length > 150) {
                return StaffAccountUpdateResult.Fail("Họ tên là bắt buộc và tối đa 150 ký tự.");
            }

            if (username.Length < 3 || username.Length > 50) {
                return StaffAccountUpdateResult.Fail("Tên đăng nhập phải từ 3–50 ký tự.");
            }

            if (password.Length < 6) {
                return StaffAccountUpdateResult.Fail("Mật khẩu phải có ít nhất 6 ký tự.");
            }

            if (string.IsNullOrWhiteSpace(phone) || phone.Length > 20) {
                return StaffAccountUpdateResult.Fail("Số điện thoại là bắt buộc và tối đa 20 ký tự.");
            }

            if (request.Roles is null || request.Roles.Count == 0) {
                return StaffAccountUpdateResult.Fail("Phải chọn ít nhất một vai trò.");
            }

            var usernameTaken = await _dbContext.Users
                .AnyAsync(u => u.Username == username, cancellationToken);
            if (usernameTaken) {
                return StaffAccountUpdateResult.Fail("Tên đăng nhập đã được sử dụng.");
            }

            var normalizedRoleNames = request.Roles
                .Select(role => role.Trim())
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var invalidRoles = normalizedRoleNames
                .Where(role => !AppRoles.All.Contains(role, StringComparer.OrdinalIgnoreCase))
                .ToList();
            if (invalidRoles.Count > 0) {
                return StaffAccountUpdateResult.Fail($"Vai trò không hợp lệ: {string.Join(", ", invalidRoles)}.");
            }

            var rolesInDb = await _dbContext.Roles
                .Where(r => normalizedRoleNames.Contains(r.Name))
                .ToListAsync(cancellationToken);
            if (rolesInDb.Count != normalizedRoleNames.Count) {
                return StaffAccountUpdateResult.Fail("Một số vai trò chưa được cấu hình trong hệ thống.");
            }

            var storeId = request.StoreId;
            if (!storeId.HasValue) {
                storeId = await _dbContext.Stores.AsNoTracking()
                    .OrderBy(s => s.Id)
                    .Select(s => (int?)s.Id)
                    .FirstOrDefaultAsync(cancellationToken);
            }
            if (!storeId.HasValue) {
                return StaffAccountUpdateResult.Fail("Không tìm thấy cửa hàng để gán cho nhân viên.");
            }

            var departmentId = request.DepartmentId;
            if (!departmentId.HasValue) {
                departmentId = await _dbContext.Departments.AsNoTracking()
                    .Where(d => d.StoreId == storeId.Value)
                    .OrderBy(d => d.Id)
                    .Select(d => (int?)d.Id)
                    .FirstOrDefaultAsync(cancellationToken);
            }
            if (!departmentId.HasValue) {
                return StaffAccountUpdateResult.Fail("Không tìm thấy phòng ban để gán cho nhân viên.");
            }

            var employeeCode = await GenerateEmployeeCodeAsync(cancellationToken);
            var now = DateTime.UtcNow;
            var employee = new Employee {
                EmployeeCode = employeeCode,
                FullName = fullName,
                DepartmentId = departmentId.Value,
                StoreId = storeId.Value,
                Status = request.IsActive ? "ACTIVE" : "LOCKED",
                Phone = phone,
                Notes = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            };

            var user = new User {
                Username = username,
                IsActive = request.IsActive ? (byte)1 : (byte)0,
                Employee = employee,
            };
            user.PasswordHash = _passwordHasher.HashPassword(user, password);

            _dbContext.Users.Add(user);
            await _dbContext.SaveChangesAsync(cancellationToken);

            foreach (var role in rolesInDb) {
                _dbContext.Set<EmployeeRole>().Add(new EmployeeRole {
                    EmployeeId = employee.Id,
                    RoleId = role.Id,
                    StoreId = employee.StoreId,
                    AssignedAt = now,
                });
            }

            await _dbContext.SaveChangesAsync(cancellationToken);

            var createdUser = await BaseAccountQuery()
                .FirstOrDefaultAsync(u => u.Id == user.Id, cancellationToken);
            if (createdUser is null) {
                return StaffAccountUpdateResult.Fail("Không thể tải dữ liệu tài khoản vừa tạo.");
            }

            return StaffAccountUpdateResult.Ok(MapDetail(createdUser));
        }

        public async Task<List<RoleOptionDto>> GetRoleOptionsAsync(CancellationToken cancellationToken = default) {
            var roles = await _dbContext.Roles
                .AsNoTracking()
                .Where(r => AppRoles.All.Contains(r.Name))
                .OrderBy(r => r.Name)
                .Select(r => new RoleOptionDto {
                    Id = r.Id,
                    Name = r.Name,
                })
                .ToListAsync(cancellationToken);

            return roles;
        }

        private IQueryable<User> BaseAccountQuery() {
            return _dbContext.Users
                .AsNoTracking()
                .Include(u => u.Employee)
                    .ThenInclude(e => e.EmployeeRoles)
                        .ThenInclude(er => er.Role)
                .Include(u => u.Employee)
                    .ThenInclude(e => e.Store)
                .Include(u => u.Employee)
                    .ThenInclude(e => e.Department)
                .Where(u => u.Employee != null);
        }

        private static StaffAccountListItemDto MapListItem(User user) {
            var employee = user.Employee!;
            return new StaffAccountListItemDto {
                UserId = user.Id,
                EmployeeId = employee.Id,
                EmployeeCode = employee.EmployeeCode,
                FullName = employee.FullName,
                Username = user.Username,
                Phone = employee.Phone,
                IsActive = user.IsActive == 1,
                EmployeeStatus = employee.Status,
                StoreId = employee.StoreId,
                StoreName = employee.Store?.Name,
                Roles = GetRoleNames(employee),
                LastLoginAtUtc = user.LastLoginAt,
            };
        }

        private static StaffAccountDetailDto MapDetail(User user) {
            var listItem = MapListItem(user);
            var employee = user.Employee!;
            return new StaffAccountDetailDto {
                UserId = listItem.UserId,
                EmployeeId = listItem.EmployeeId,
                EmployeeCode = listItem.EmployeeCode,
                FullName = listItem.FullName,
                Username = listItem.Username,
                Phone = listItem.Phone,
                IsActive = listItem.IsActive,
                EmployeeStatus = listItem.EmployeeStatus,
                StoreId = listItem.StoreId,
                StoreName = listItem.StoreName,
                Roles = listItem.Roles,
                LastLoginAtUtc = listItem.LastLoginAtUtc,
                Note = employee.Notes,
                DepartmentId = employee.DepartmentId,
                DepartmentName = employee.Department?.Name,
            };
        }

        private static List<string> GetRoleNames(Employee employee) {
            return employee.EmployeeRoles
                .Select(er => er.Role.Name)
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(role => role, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private async Task<string> GenerateEmployeeCodeAsync(CancellationToken cancellationToken) {
            var today = DateTime.UtcNow.ToString("yyyyMMdd");
            var prefix = $"NV{today}";

            var lastCode = await _dbContext.Set<Employee>()
                .AsNoTracking()
                .Where(e => e.EmployeeCode.StartsWith(prefix))
                .OrderByDescending(e => e.EmployeeCode)
                .Select(e => e.EmployeeCode)
                .FirstOrDefaultAsync(cancellationToken);

            var nextNumber = 1;
            if (!string.IsNullOrWhiteSpace(lastCode) && lastCode.Length > prefix.Length) {
                var suffix = lastCode[prefix.Length..];
                if (int.TryParse(suffix, out var current)) {
                    nextNumber = current + 1;
                }
            }

            return $"{prefix}{nextNumber:D3}";
        }
    }
}
