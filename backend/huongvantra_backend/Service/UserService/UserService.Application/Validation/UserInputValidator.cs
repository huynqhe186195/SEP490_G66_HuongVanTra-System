using System.Text.RegularExpressions;
using UserService.Domain.Exceptions;

namespace UserService.Application.Validation;

public static class UserInputValidator
{
    private static readonly Regex PhoneRegex = new(@"^0\d{9}$", RegexOptions.Compiled);

    public static void ValidateSingleRole(IReadOnlyCollection<int>? roleIds)
    {
        if (roleIds is null || roleIds.Count == 0)
            throw new UserValidationException("Vui lòng chọn một vai trò.");

        if (roleIds.Count > 1)
            throw new UserValidationException("Mỗi tài khoản chỉ được gán một vai trò.");
    }

    public static void ValidatePhoneIfProvided(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return;

        var normalized = phone.Trim();
        if (!PhoneRegex.IsMatch(normalized))
            throw new UserValidationException("Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.");
    }
}
