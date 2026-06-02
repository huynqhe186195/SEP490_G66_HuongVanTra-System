using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HuongVanTra.Service.Employees {
    public class EmployeeService : IEmployeeService {
        private readonly AppDbContext _dbContext;

        public EmployeeService(AppDbContext dbContext) {
            _dbContext = dbContext;
        }

        public async Task<List<EmployeeListItemResponse>> GetEmployeesAsync(
            string? keyword,
            string? status,
            int? storeId,
            int? departmentId) {
            var query = _dbContext.Set<Employee>()
                .AsNoTracking()
                .Include(e => e.Department)
                .Include(e => e.User)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(keyword)) {
                var keywordValue = keyword.Trim();
                query = query.Where(e =>
                    e.EmployeeCode.Contains(keywordValue) ||
                    e.FullName.Contains(keywordValue));
            }

            if (!string.IsNullOrWhiteSpace(status)) {
                var statusValue = status.Trim();
                query = query.Where(e => e.Status == statusValue);
            }

            if (storeId.HasValue) {
                query = query.Where(e => e.StoreId == storeId.Value);
            }

            if (departmentId.HasValue) {
                query = query.Where(e => e.DepartmentId == departmentId.Value);
            }

            return await query
                .OrderBy(e => e.FullName)
                .Select(e => new EmployeeListItemResponse {
                    EmployeeId = e.Id,
                    EmployeeCode = e.EmployeeCode,
                    FullName = e.FullName,
                    DepartmentId = e.DepartmentId,
                    DepartmentName = e.Department != null ? e.Department.Name : null,
                    StoreId = e.StoreId,
                    Status = e.Status,
                    HasUserAccount = e.User != null,
                    Username = e.User != null ? e.User.Username : null
                })
                .ToListAsync();
        }

        public async Task<EmployeeDetailResponse?> GetEmployeeByIdAsync(int id) {
            var employee = await _dbContext.Set<Employee>()
                .AsNoTracking()
                .Include(e => e.Department)
                .Include(e => e.User)
                .Include(e => e.EmployeeRoles)
                    .ThenInclude(er => er.Role)
                .FirstOrDefaultAsync(e => e.Id == id);

            return employee is null ? null : MapDetail(employee);
        }

        public async Task<EmployeeUpdateResult> UpdateEmployeeAsync(int id, UpdateEmployeeRequest request) {
            var employee = await _dbContext.Set<Employee>()
                .Include(e => e.Department)
                .Include(e => e.User)
                .Include(e => e.EmployeeRoles)
                    .ThenInclude(er => er.Role)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (employee is null) {
                return EmployeeUpdateResult.Failure("Employee not found.");
            }

            if (!await _dbContext.Departments.AnyAsync(d => d.Id == request.DepartmentId)) {
                return EmployeeUpdateResult.Failure("Department not found.");
            }

            if (!await _dbContext.Stores.AnyAsync(s => s.Id == request.StoreId)) {
                return EmployeeUpdateResult.Failure("Store not found.");
            }

            employee.FullName = request.FullName!.Trim();
            employee.DepartmentId = request.DepartmentId;
            employee.StoreId = request.StoreId;
            employee.Status = request.Status!.Trim();

            await _dbContext.SaveChangesAsync();

            await _dbContext.Entry(employee).Reference(e => e.Department).LoadAsync();
            return EmployeeUpdateResult.Success(MapDetail(employee));
        }

        private static EmployeeDetailResponse MapDetail(Employee employee) {
            return new EmployeeDetailResponse {
                EmployeeId = employee.Id,
                EmployeeCode = employee.EmployeeCode,
                FullName = employee.FullName,
                DepartmentId = employee.DepartmentId,
                DepartmentName = employee.Department?.Name,
                StoreId = employee.StoreId,
                Status = employee.Status,
                UserAccount = employee.User is null
                    ? null
                    : new EmployeeUserAccountResponse {
                        UserId = employee.User.Id,
                        Username = employee.User.Username,
                        IsActive = employee.User.IsActive == 1,
                        LastLoginAtUtc = employee.User.LastLoginAt
                    },
                Roles = employee.EmployeeRoles
                    .Select(er => er.Role.Name)
                    .Where(role => !string.IsNullOrWhiteSpace(role))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList()
            };
        }
    }
}
