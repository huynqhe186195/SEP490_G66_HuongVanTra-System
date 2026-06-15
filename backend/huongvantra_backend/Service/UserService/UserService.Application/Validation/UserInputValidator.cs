using UserService.Domain.Exceptions;

namespace UserService.Application.Validation;

public static class UserInputValidator
{
    public static void ValidateSingleRole(IReadOnlyCollection<int>? roleIds)
    {
        if (roleIds is null || roleIds.Count == 0)
            throw new UserValidationException("Vui lòng chọn một vai trò.");

        if (roleIds.Count > 1)
            throw new UserValidationException("Mỗi tài khoản chỉ được gán một vai trò.");
    }

    public static void ValidatePhoneIfProvided(string? phone)
    {
        VietnamPhoneValidator.ValidateIfProvided(phone);
    }
}
