using CustomerService.Domain.Exceptions;
using System.Text.Json;

namespace CustomerService.WebAPI.Middlewares;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception");
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        var (statusCode, message, errors) = ex switch
        {
            CustomerNotFoundException => (StatusCodes.Status404NotFound, ex.Message, null),
            DuplicatePhoneNumberException => (StatusCodes.Status409Conflict, ex.Message, null),
            DuplicateEmailException => (StatusCodes.Status409Conflict, ex.Message, null),
            CustomerValidationException validation => (StatusCodes.Status400BadRequest, validation.Message, validation.Errors),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.", null)
        };

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var body = JsonSerializer.Serialize(new { error = message, statusCode, errors });
        return context.Response.WriteAsync(body);
    }
}
