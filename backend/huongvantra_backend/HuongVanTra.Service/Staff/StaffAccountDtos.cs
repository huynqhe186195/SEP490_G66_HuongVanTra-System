namespace HuongVanTra.Service.Staff {
    public class StaffAccountListItemDto {
        public int UserId { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public bool IsActive { get; set; }
        public string EmployeeStatus { get; set; } = string.Empty;
        public int StoreId { get; set; }
        public string? StoreName { get; set; }
        public List<string> Roles { get; set; } = new();
        public DateTime? LastLoginAtUtc { get; set; }
    }

    public class StaffAccountDetailDto : StaffAccountListItemDto {
        public string? Note { get; set; }
        public int DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
    }

    public class StaffAccountQuery {
        public string? Search { get; set; }
        public string? Role { get; set; }
        public bool? IsActive { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class UpdateStaffAccountDto {
        public string? FullName { get; set; }
        public string? Phone { get; set; }
        public string? Note { get; set; }
        public string? Username { get; set; }
        public bool? IsActive { get; set; }
        public string? NewPassword { get; set; }
    }

    public class AssignStaffRolesDto {
        public List<string> Roles { get; set; } = new();
    }

    public class CreateStaffAccountDto {
        public string FullName { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Note { get; set; }
        public bool IsActive { get; set; } = true;
        public int? StoreId { get; set; }
        public int? DepartmentId { get; set; }
        public List<string> Roles { get; set; } = new();
    }

    public class RoleOptionDto {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public class StaffAccountUpdateResult {
        public bool Success { get; set; }
        public string? ErrorMessage { get; set; }
        public StaffAccountDetailDto? Account { get; set; }

        public static StaffAccountUpdateResult Fail(string message) => new() {
            Success = false,
            ErrorMessage = message,
        };

        public static StaffAccountUpdateResult Ok(StaffAccountDetailDto account) => new() {
            Success = true,
            Account = account,
        };
    }
}
