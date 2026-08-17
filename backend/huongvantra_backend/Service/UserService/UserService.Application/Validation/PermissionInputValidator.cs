using System.Text.RegularExpressions;
using UserService.Domain.Exceptions;

namespace UserService.Application.Validation;

public static class PermissionInputValidator
{
    private static readonly Regex PermissionNameRegex = new(
        @"^[\p{L}][\p{L}0-9]*(?: [\p{L}][\p{L}0-9]*)*$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex PermissionCodeRegex = new(
        @"^[A-Z][A-Z0-9_]*$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static (string Name, string Code) NormalizeAndValidate(string? permissionName, string? permissionCode)
    {
        var name = (permissionName ?? string.Empty).Trim();
        var code = (permissionCode ?? string.Empty).Trim().ToUpperInvariant();

        if (string.IsNullOrWhiteSpace(name))
            throw new UserValidationException("Tên quyền không được để trống.");

        if (string.IsNullOrWhiteSpace(code))
            throw new UserValidationException("Mã quyền không được để trống.");

        if (name.Length > 100)
            throw new UserValidationException("Tên quyền không được vượt quá 100 ký tự.");

        if (code.Length > 100)
            throw new UserValidationException("Mã quyền không được vượt quá 100 ký tự.");

        if (!PermissionNameRegex.IsMatch(name))
            throw new UserValidationException(
                "Tên quyền không hợp lệ. Chỉ dùng chữ, số và khoảng trắng (không dùng ~, /, _ hoặc ký tự đặc biệt).");

        if (!PermissionCodeRegex.IsMatch(code))
            throw new UserValidationException(
                "Mã quyền không hợp lệ. Dùng chữ in hoa, số và gạch dưới, không có khoảng trắng (ví dụ: EXPORT_LOG).");

        return (name, code);
    }
}
