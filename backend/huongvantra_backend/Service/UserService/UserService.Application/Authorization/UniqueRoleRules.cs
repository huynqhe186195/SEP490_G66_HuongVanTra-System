using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Domain.Exceptions;

namespace UserService.Application.Authorization;

/// <summary>
/// Mô hình vận hành 1 chi nhánh: mỗi vai trò dưới đây chỉ được đúng 1 người đang hoạt động giữ.
/// Khóa hoặc ngừng sử dụng tài khoản cũ sẽ giải phóng chỗ cho người kế nhiệm.
/// </summary>
public static class UniqueRoleRules
{
    private static readonly Dictionary<string, string> SingleHolderRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        [StaffManagementScope.ManagerRoleName] = "Quản lý chi nhánh",
        [StaffManagementScope.AccountantRoleName] = "Kế toán",
        [StaffManagementScope.WarehouseRoleName] = "Thủ kho",
    };

    public static bool IsSingleHolderRole(string? roleName) =>
        !string.IsNullOrWhiteSpace(roleName) && SingleHolderRoles.ContainsKey(roleName);

    public static async Task EnsureSingleHolderAsync(
        IUserRepository userRepo,
        IEnumerable<string> nextRoleNames,
        Guid? targetUserId = null)
    {
        var restricted = nextRoleNames
            .Where(IsSingleHolderRole)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var roleName in restricted)
        {
            var holder = await userRepo.FindActiveHolderOfRoleAsync(roleName, targetUserId);
            if (holder is null)
                continue;

            var label = SingleHolderRoles[roleName];

            throw new UserValidationException(
                $"Hệ thống chỉ cho phép duy nhất 1 {label} đang hoạt động. "
                + $"Tài khoản {DescribeHolder(holder)} đang giữ vai trò này. "
                + $"Vui lòng khóa hoặc gỡ vai trò {label} của tài khoản đó trước khi gán cho người khác.");
        }
    }

    public static async Task<IReadOnlyList<SingleHolderRoleStatusResponse>> GetStatusAsync(IUserRepository userRepo)
    {
        var statuses = new List<SingleHolderRoleStatusResponse>();

        foreach (var (roleName, label) in SingleHolderRoles)
        {
            var holder = await userRepo.FindActiveHolderOfRoleAsync(roleName);
            statuses.Add(new SingleHolderRoleStatusResponse(
                roleName,
                label,
                holder is not null,
                holder?.Id,
                holder is null ? null : DescribeHolder(holder)));
        }

        return statuses;
    }

    private static string DescribeHolder(Domain.Entities.User holder) =>
        string.IsNullOrWhiteSpace(holder.Employee?.FullName)
            ? holder.Username
            : $"{holder.Employee!.FullName} ({holder.Username})";
}
