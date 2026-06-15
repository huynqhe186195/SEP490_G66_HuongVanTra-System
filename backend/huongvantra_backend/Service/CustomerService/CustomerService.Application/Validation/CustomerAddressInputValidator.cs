using System.Text;
using System.Text.RegularExpressions;
using CustomerService.Domain.Exceptions;

namespace CustomerService.Application.Validation;

public static class CustomerAddressInputValidator
{
    private static readonly Regex DigitsOnlyRegex = new(@"^\d+$", RegexOptions.Compiled);
    private static readonly Regex LettersOnlyRegex = new(@"^[\p{L}\s]+$", RegexOptions.Compiled);

    private static bool IsLettersOnly(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormC);
        return LettersOnlyRegex.IsMatch(normalized) && normalized.Any(char.IsLetter);
    }

    public static ValidatedCustomerAddressInput Validate(
        string? receiverNameValue,
        string? receiverPhoneValue,
        string? addressLineValue,
        string? wardValue,
        string? districtValue,
        string? provinceValue)
    {
        var errors = new List<string>();

        var receiverName = receiverNameValue?.Trim().Normalize(NormalizationForm.FormC);
        if (string.IsNullOrWhiteSpace(receiverName))
            errors.Add("Tên người nhận là bắt buộc.");
        else if (receiverName.Length < 2)
            errors.Add("Tên người nhận phải có ít nhất 2 ký tự.");
        else if (receiverName.Length > 100)
            errors.Add("Tên người nhận tối đa 100 ký tự.");
        else if (!IsLettersOnly(receiverName))
            errors.Add("Tên người nhận chỉ được chứa chữ cái và khoảng trắng.");

        var receiverPhone = receiverPhoneValue?.Trim();
        if (string.IsNullOrWhiteSpace(receiverPhone))
            receiverPhone = string.Empty;
        else if (!VietnamPhoneValidator.TryValidate(receiverPhone, out var receiverPhoneError))
            errors.Add(receiverPhoneError!.Replace("Số điện thoại", "Số điện thoại người nhận"));

        var addressLine = addressLineValue?.Trim();
        if (string.IsNullOrWhiteSpace(addressLine))
            errors.Add("Địa chỉ (số nhà, đường) là bắt buộc.");
        else if (addressLine.Length < 5)
            errors.Add("Địa chỉ phải có ít nhất 5 ký tự.");
        else if (addressLine.Length > 255)
            errors.Add("Địa chỉ tối đa 255 ký tự.");
        else if (DigitsOnlyRegex.IsMatch(addressLine))
            errors.Add("Địa chỉ không được chỉ gồm chữ số.");

        var ward = wardValue?.Trim();
        if (string.IsNullOrWhiteSpace(ward))
            errors.Add("Phường / xã là bắt buộc.");
        else if (ward.Length > 100)
            errors.Add("Phường / xã tối đa 100 ký tự.");

        var district = districtValue?.Trim();
        if (string.IsNullOrWhiteSpace(district))
            errors.Add("Quận / huyện là bắt buộc.");
        else if (district.Length > 100)
            errors.Add("Quận / huyện tối đa 100 ký tự.");

        var province = provinceValue?.Trim();
        if (string.IsNullOrWhiteSpace(province))
            errors.Add("Tỉnh / thành phố là bắt buộc.");
        else if (province.Length > 100)
            errors.Add("Tỉnh / thành phố tối đa 100 ký tự.");

        if (errors.Count > 0)
            throw new CustomerValidationException(errors);

        return new ValidatedCustomerAddressInput(
            receiverName!,
            receiverPhone!,
            addressLine!,
            ward!,
            district!,
            province!);
    }
}

public record ValidatedCustomerAddressInput(
    string ReceiverName,
    string ReceiverPhone,
    string AddressLine,
    string Ward,
    string District,
    string Province);
