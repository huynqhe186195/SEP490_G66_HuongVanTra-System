using UserService.Domain.Exceptions;

namespace UserService.Application.Validation;

public static class UserInputValidator
{
    public static IReadOnlyList<int> ResolveRoleIds(
        IReadOnlyCollection<int>? roleIds,
        int? legacyRoleId = null)
    {
        var resolved = roleIds is { Count: > 0 }
            ? roleIds.ToList()
            : legacyRoleId.HasValue
                ? [legacyRoleId.Value]
                : [];

        if (resolved.Count == 0)
            throw new UserValidationException("Vui lòng chọn ít nhất một vai trò.");

        if (resolved.Count != resolved.Distinct().Count())
            throw new UserValidationException("Danh sách vai trò không được chứa giá trị trùng lặp.");

        return resolved;
    }

    public static void ValidateBasicInformation(string? username, string? password, string? fullName)
    {
        if (string.IsNullOrWhiteSpace(username))
            throw new UserValidationException("Tên đăng nhập không được để trống.");

        if (string.IsNullOrWhiteSpace(password))
            throw new UserValidationException("Mật khẩu không được để trống.");

        if (string.IsNullOrWhiteSpace(fullName))
            throw new UserValidationException("Họ và tên không được để trống.");
    }

    public static void ValidatePhoneIfProvided(string? phone)
    {
        VietnamPhoneValidator.ValidateIfProvided(phone);
    }
}
