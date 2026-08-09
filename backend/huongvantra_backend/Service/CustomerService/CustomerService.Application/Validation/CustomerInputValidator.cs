using System.Text;
using System.Text.RegularExpressions;
using CustomerService.Domain.Enums;
using CustomerService.Domain.Exceptions;

namespace CustomerService.Application.Validation;

public static class CustomerInputValidator
{
    private static readonly Regex EmailRegex = new(
        @"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex DigitsOnlyRegex = new(@"^\d+$", RegexOptions.Compiled);
    private static readonly Regex LettersOnlyRegex = new(@"^[\p{L}\s]+$", RegexOptions.Compiled);

    private static bool IsDigitsOnly(string value) => DigitsOnlyRegex.IsMatch(value);

    private static bool IsLettersOnly(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormC);
        return LettersOnlyRegex.IsMatch(normalized) && normalized.Any(char.IsLetter);
    }

    public static ValidatedCustomerInput Validate(
        string? fullNameValue,
        string? phoneNumberValue,
        string? emailValue,
        string? addressLineValue,
        CustomerGroup customerGroup,
        string? taxCodeValue,
        int? tierId,
        Guid? assignedSaleId,
        CustomerSource? source,
        string? department,
        string? registeredAddress = null,
        string? legalRepresentativeName = null,
        string? legalRepresentativePosition = null,
        string? legalRepresentativeIdNumber = null,
        string? legalRepresentativeIdIssuePlace = null,
        DateOnly? legalRepresentativeIdIssueDate = null,
        string? bankAccountNumber = null,
        string? bankName = null)
    {
        var errors = new List<string>();
        var isCorporate = customerGroup == CustomerGroup.DoanhNghiep;

        var fullName = fullNameValue?.Trim().Normalize(NormalizationForm.FormC);
        if (string.IsNullOrWhiteSpace(fullName))
            errors.Add(isCorporate ? "Tên công ty là bắt buộc." : "Họ tên là bắt buộc.");
        else if (fullName.Length < 2)
            errors.Add(isCorporate ? "Tên công ty phải có ít nhất 2 ký tự." : "Họ tên phải có ít nhất 2 ký tự.");
        else if (fullName.Length > 100)
            errors.Add(isCorporate ? "Tên công ty tối đa 100 ký tự." : "Họ tên tối đa 100 ký tự.");
        else if (isCorporate)
        {
            if (!fullName.Any(char.IsLetter))
                errors.Add("Tên công ty phải chứa ít nhất một chữ cái.");
        }
        else if (!IsLettersOnly(fullName))
            errors.Add("Họ tên chỉ được chứa chữ cái và khoảng trắng (hỗ trợ tiếng Việt có dấu).");

        var phoneNumber = phoneNumberValue?.Trim();
        if (!VietnamPhoneValidator.TryValidate(phoneNumber, out var phoneError))
            errors.Add(phoneError!);

        var email = emailValue?.Trim();
        if (string.IsNullOrWhiteSpace(email))
            email = null;
        else if (email.Length > 100)
            errors.Add("Email không đúng định dạng. Vui lòng nhập theo mẫu ten@domain.com (ví dụ: nguyenvana@gmail.com), tối đa 100 ký tự.");
        else if (!EmailRegex.IsMatch(email))
            errors.Add("Email không đúng định dạng. Vui lòng nhập đầy đủ phần tên, ký tự @ và tên miền (ví dụ: nguyenvana@gmail.com).");

        var addressLine = addressLineValue?.Trim();
        if (string.IsNullOrWhiteSpace(addressLine))
            errors.Add("Địa chỉ là bắt buộc.");
        else if (addressLine.Length < 5)
            errors.Add("Địa chỉ phải có ít nhất 5 ký tự.");
        else if (addressLine.Length > 255)
            errors.Add("Địa chỉ tối đa 255 ký tự.");
        else if (IsDigitsOnly(addressLine))
            errors.Add("Địa chỉ không được chỉ gồm chữ số.");

        if (!Enum.IsDefined(typeof(CustomerGroup), customerGroup))
            errors.Add("Loại khách hàng không hợp lệ.");

        var taxCode = taxCodeValue?.Trim();
        if (string.IsNullOrWhiteSpace(taxCode))
            taxCode = null;

        if (!VietnamTaxCodeValidator.TryValidate(
                taxCode,
                customerGroup == CustomerGroup.DoanhNghiep,
                out var taxCodeError))
            errors.Add(taxCodeError!);

        if (assignedSaleId == Guid.Empty)
            errors.Add("Mã nhân viên phụ trách không hợp lệ.");

        var normalizedDepartment = department?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedDepartment))
            normalizedDepartment = null;
        else if (normalizedDepartment.Length > 100)
            errors.Add("Phòng ban tối đa 100 ký tự.");

        if (source.HasValue && !Enum.IsDefined(typeof(CustomerSource), source.Value))
            errors.Add("Nguồn khách hàng không hợp lệ.");

        var normalizedRegisteredAddress = registeredAddress?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedRegisteredAddress))
            normalizedRegisteredAddress = null;
        else if (normalizedRegisteredAddress.Length > 255)
            errors.Add("Địa chỉ trụ sở chính tối đa 255 ký tự.");

        var normalizedLegalRepName = legalRepresentativeName?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedLegalRepName))
            normalizedLegalRepName = null;
        else if (normalizedLegalRepName.Length > 100)
            errors.Add("Tên đại diện theo pháp luật tối đa 100 ký tự.");

        var normalizedLegalRepPosition = legalRepresentativePosition?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedLegalRepPosition))
            normalizedLegalRepPosition = null;
        else if (normalizedLegalRepPosition.Length > 100)
            errors.Add("Chức vụ đại diện theo pháp luật tối đa 100 ký tự.");

        var normalizedLegalRepIdNumber = legalRepresentativeIdNumber?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedLegalRepIdNumber))
            normalizedLegalRepIdNumber = null;
        else if (normalizedLegalRepIdNumber.Length > 50)
            errors.Add("Số CMND/CCCD tối đa 50 ký tự.");

        var normalizedLegalRepIdIssuePlace = legalRepresentativeIdIssuePlace?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedLegalRepIdIssuePlace))
            normalizedLegalRepIdIssuePlace = null;
        else if (normalizedLegalRepIdIssuePlace.Length > 100)
            errors.Add("Nơi cấp CMND/CCCD tối đa 100 ký tự.");

        var normalizedBankAccountNumber = bankAccountNumber?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedBankAccountNumber))
            normalizedBankAccountNumber = null;
        else if (normalizedBankAccountNumber.Length > 50)
            errors.Add("Số tài khoản ngân hàng tối đa 50 ký tự.");

        var normalizedBankName = bankName?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedBankName))
            normalizedBankName = null;
        else if (normalizedBankName.Length > 150)
            errors.Add("Tên ngân hàng tối đa 150 ký tự.");

        if (errors.Count > 0)
            throw new CustomerValidationException(errors);

        return new ValidatedCustomerInput(
            fullName!,
            phoneNumber!,
            email,
            addressLine!,
            customerGroup,
            taxCode,
            tierId,
            assignedSaleId,
            source,
            normalizedDepartment,
            normalizedRegisteredAddress,
            normalizedLegalRepName,
            normalizedLegalRepPosition,
            normalizedLegalRepIdNumber,
            normalizedLegalRepIdIssuePlace,
            legalRepresentativeIdIssueDate,
            normalizedBankAccountNumber,
            normalizedBankName);
    }
}

public record ValidatedCustomerInput(
    string FullName,
    string PhoneNumber,
    string? Email,
    string AddressLine,
    CustomerGroup CustomerGroup,
    string? TaxCode,
    int? TierId,
    Guid? AssignedSaleId,
    CustomerSource? Source,
    string? Department,
    string? RegisteredAddress = null,
    string? LegalRepresentativeName = null,
    string? LegalRepresentativePosition = null,
    string? LegalRepresentativeIdNumber = null,
    string? LegalRepresentativeIdIssuePlace = null,
    DateOnly? LegalRepresentativeIdIssueDate = null,
    string? BankAccountNumber = null,
    string? BankName = null);
