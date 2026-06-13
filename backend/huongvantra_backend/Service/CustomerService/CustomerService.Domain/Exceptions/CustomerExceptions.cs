namespace CustomerService.Domain.Exceptions;

public class CustomerNotFoundException : Exception
{
    public CustomerNotFoundException(Guid id)
        : base($"Customer with id '{id}' was not found.") { }
}

public class DuplicatePhoneNumberException : Exception
{
    public DuplicatePhoneNumberException(string phone)
        : base($"Số điện thoại '{phone}' đã được đăng ký.") { }
}

public class DuplicateEmailException : Exception
{
    public DuplicateEmailException(string email)
        : base($"Email '{email}' đã được sử dụng. Vui lòng nhập email khác hoặc để trống nếu khách chưa có email.") { }
}

public class CustomerValidationException : Exception
{
    public CustomerValidationException(IEnumerable<string> errors)
        : base("One or more validation errors occurred.")
    {
        Errors = errors.ToArray();
    }

    public IReadOnlyCollection<string> Errors { get; }
}

public class CustomerForbiddenException : Exception
{
    public CustomerForbiddenException()
        : base("Bạn không có quyền truy cập khách hàng này.") { }
}
