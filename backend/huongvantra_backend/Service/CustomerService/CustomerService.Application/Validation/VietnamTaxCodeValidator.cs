using System.Text.RegularExpressions;

namespace CustomerService.Application.Validation;

public static class VietnamTaxCodeValidator
{
    private static readonly Regex TaxCodeRegex = new(@"^\d{10}(-\d{3})?$", RegexOptions.Compiled);

    public static bool TryValidate(string? taxCode, bool required, out string? errorMessage)
    {
        errorMessage = null;
        var value = taxCode?.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            if (required)
            {
                errorMessage = "Khách doanh nghiệp cần mã số thuế.";
                return false;
            }

            return true;
        }

        if (!TaxCodeRegex.IsMatch(value))
        {
            errorMessage =
                "Mã số thuế không hợp lệ. Nhập 10 chữ số hoặc 10 chữ số + \"-\" + 3 chữ số chi nhánh (VD: 0312345678 hoặc 0312345678-001).";
            return false;
        }

        return true;
    }
}
