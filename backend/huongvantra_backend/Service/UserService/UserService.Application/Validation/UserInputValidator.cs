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

    public static void ValidatePhoneIfProvided(string? phone)
    {
        VietnamPhoneValidator.ValidateIfProvided(phone);
    }
}
