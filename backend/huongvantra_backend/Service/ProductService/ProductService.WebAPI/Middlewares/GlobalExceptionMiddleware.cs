using System.Text.Json;
using ProductService.Domain.Exceptions;

namespace ProductService.WebAPI.Middlewares;

public class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        var (statusCode, message, errors) = ex switch
        {
            ProductValidationException v     => (StatusCodes.Status400BadRequest,  v.Message, v.Errors),
            ProductNotFoundException e       => (StatusCodes.Status404NotFound,    e.Message, null),
            ProductSkuNotFoundException e    => (StatusCodes.Status404NotFound,    e.Message, null),
            ProductSkuNotFoundByCodeException e => (StatusCodes.Status404NotFound, e.Message, null),
            CategoryNotFoundException e      => (StatusCodes.Status404NotFound,    e.Message, null),
            DuplicateSkuCodeException e      => (StatusCodes.Status409Conflict,    e.Message, null),
            _                                => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.", null)
        };

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var body = JsonSerializer.Serialize(
            new { error = message, statusCode, errors },
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

        return context.Response.WriteAsync(body);
    }
}
