using System.Text.RegularExpressions;
using UserService.Domain.Exceptions;

namespace UserService.Application.Validation;

public static class UserInputValidator
{
    public const int UsernameMaxLength = 50;
    public const string EmptyUsernameMessage = "Tên đăng nhập không được để trống";
    public const string InvalidUsernameMessage = "Tên đăng nhập không hợp lệ";
    public const string UsernameTooLongMessage = "Tên đăng nhập không được dài hơn 50 ký tự";
    public const string EmptyPasswordMessage = "Mật khẩu không được để trống";
    public const string InvalidPasswordMessage = "Mật khẩu không hợp lệ";
    public const int PasswordMinLength = 8;
    public const string PasswordTooShortMessage = "Mật khẩu phải có ít nhất 8 ký tự.";
    public const string NewPasswordTooShortMessage = "Mật khẩu mới phải có ít nhất 8 ký tự.";
    public const string EmptyFullNameMessage = "Họ và tên không được để trống";
    public const string InvalidFullNameMessage = "Họ và tên không hợp lệ";
    public const string EmptyRolesMessage = "Vui lòng chọn ít nhất một vai trò";

    private static readonly Regex UsernameRegex = new(
        @"^[A-Za-z][A-Za-z0-9_]*$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex PasswordRegex = new(
        @"^[A-Za-z0-9]+$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex FullNameRegex = new(
        @"^[\p{L}]+(?: [\p{L}]+)*$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static IReadOnlyList<int> ResolveRoleIds(
        IReadOnlyCollection<int>? roleIds,
        int? legacyRoleId = null)
    {
        var resolved = (roleIds ?? [])
            .Where(id => id > 0)
            .ToList();

        if (resolved.Count == 0 && legacyRoleId is > 0)
            resolved.Add(legacyRoleId.Value);

        if (resolved.Count == 0)
            throw new UserValidationException(EmptyRolesMessage);

        if (resolved.Count != resolved.Distinct().Count())
            throw new UserValidationException("Danh sách vai trò không được chứa giá trị trùng lặp.");

        return resolved;
    }

    public static string NormalizeAndValidateUsername(string? username)
    {
        var value = (username ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(value))
            throw new UserValidationException(EmptyUsernameMessage);

        if (value.Length > UsernameMaxLength)
            throw new UserValidationException(UsernameTooLongMessage);

        if (!UsernameRegex.IsMatch(value))
            throw new UserValidationException(InvalidUsernameMessage);

        return value;
    }

    public static string ValidatePassword(string? password)
    {
        if (string.IsNullOrWhiteSpace(password))
            throw new UserValidationException(EmptyPasswordMessage);

        if (password.Length < PasswordMinLength)
            throw new UserValidationException(PasswordTooShortMessage);

        if (!PasswordRegex.IsMatch(password))
            throw new UserValidationException(InvalidPasswordMessage);

        return password;
    }

    public static string NormalizeAndValidateFullName(string? fullName)
    {
        var value = (fullName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(value))
            throw new UserValidationException(EmptyFullNameMessage);

        if (!FullNameRegex.IsMatch(value))
            throw new UserValidationException(InvalidFullNameMessage);

        return value;
    }

    public static void ValidateNewPassword(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < PasswordMinLength)
            throw new UserValidationException(NewPasswordTooShortMessage);

        if (!PasswordRegex.IsMatch(password))
            throw new UserValidationException("Mật khẩu mới không hợp lệ");
    }

    public static void ValidatePhoneIfProvided(string? phone)
    {
        VietnamPhoneValidator.ValidateIfProvided(phone);
    }
}
