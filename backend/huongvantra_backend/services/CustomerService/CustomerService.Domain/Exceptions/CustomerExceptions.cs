namespace CustomerService.Domain.Exceptions;

public class CustomerNotFoundException : Exception
{
    public CustomerNotFoundException(Guid id)
        : base($"Customer with id '{id}' was not found.") { }
}

public class DuplicatePhoneNumberException : Exception
{
    public DuplicatePhoneNumberException(string phone)
        : base($"Phone number '{phone}' is already registered.") { }
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
