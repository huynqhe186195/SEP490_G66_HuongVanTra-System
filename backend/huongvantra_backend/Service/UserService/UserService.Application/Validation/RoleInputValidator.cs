using System.Text.RegularExpressions;
using UserService.Domain.Exceptions;

namespace UserService.Application.Validation;

public static class RoleInputValidator
{
    private static readonly Regex RoleNameRegex = new(
        @"^[\p{L}][\p{L}0-9]*(?: [\p{L}][\p{L}0-9]*)*$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public const string EmptyNameMessage = "Tên vai trò không được để trống";
    public const string InvalidNameMessage = "Tên vai trò không hợp lệ";
    public const string EmptyPermissionsMessage = "Quyền thao tác không được để trống";

    public static string NormalizeAndValidateName(string? roleName)
    {
        var name = (roleName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new UserValidationException(EmptyNameMessage);

        if (name.Length > 50 || !RoleNameRegex.IsMatch(name))
            throw new UserValidationException(InvalidNameMessage);

        return name;
    }

    public static IReadOnlyList<int> NormalizePermissionIds(IEnumerable<int>? permissionIds)
    {
        var ids = (permissionIds ?? []).Distinct().ToList();
        if (ids.Count == 0)
            throw new UserValidationException(EmptyPermissionsMessage);

        return ids;
    }

    public static string MissingPermissionsMessage(IReadOnlyCollection<int> missingIds) =>
        $"Quyền với ID '{string.Join(", ", missingIds)}' không tồn tại";
}
