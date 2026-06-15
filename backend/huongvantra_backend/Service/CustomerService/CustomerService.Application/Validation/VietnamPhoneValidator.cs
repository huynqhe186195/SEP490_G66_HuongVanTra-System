using System.Text.RegularExpressions;

namespace CustomerService.Application.Validation;

public static class VietnamPhoneValidator
{
    private static readonly Regex DigitsOnlyRegex = new(@"^\d+$", RegexOptions.Compiled);

    public static bool TryValidate(string? phone, out string? errorMessage)
    {
        errorMessage = null;
        var value = phone?.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            errorMessage = "Số điện thoại là bắt buộc.";
            return false;
        }

        if (!DigitsOnlyRegex.IsMatch(value) || !value.StartsWith('0'))
        {
            errorMessage = "Số điện thoại chỉ gồm chữ số và bắt đầu bằng 0.";
            return false;
        }

        if (value.StartsWith("02"))
        {
            if (value.Length != 11)
            {
                errorMessage = "Số máy bàn phải gồm 11 chữ số và bắt đầu bằng 02.";
                return false;
            }

            return true;
        }

        if (value.Length != 10)
        {
            errorMessage = "Số di động phải gồm 10 chữ số và bắt đầu bằng 0.";
            return false;
        }

        return true;
    }
}
