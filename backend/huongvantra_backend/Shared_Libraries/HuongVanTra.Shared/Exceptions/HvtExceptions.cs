namespace HuongVanTra.Shared.Exceptions;

public abstract class HvtException : Exception
{
    public int StatusCode { get; }
    protected HvtException(string message, int statusCode) : base(message)
        => StatusCode = statusCode;
}

public class NotFoundException : HvtException
{
    public NotFoundException(string resource, object id)
        : base($"{resource} '{id}' was not found.", 404) { }
}

public class ConflictException : HvtException
{
    public ConflictException(string message) : base(message, 409) { }
}

public class ValidationException : HvtException
{
    public IEnumerable<string> Errors { get; }
    public ValidationException(IEnumerable<string> errors)
        : base("One or more validation errors occurred.", 422)
        => Errors = errors;
}

public class UnauthorizedException : HvtException
{
    public UnauthorizedException(string message = "Unauthorized.")
        : base(message, 401) { }
}

public class ForbiddenException : HvtException
{
    public ForbiddenException(string message = "Forbidden.")
        : base(message, 403) { }
}
