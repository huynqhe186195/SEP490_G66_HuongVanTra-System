using System.Text.Json;
using OrderService.Domain.Exceptions;

namespace OrderService.WebAPI.Middlewares;

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
            OrderValidationException v          => (StatusCodes.Status400BadRequest,  v.Message, v.Errors),
            OrderNotFoundException e            => (StatusCodes.Status404NotFound,    e.Message, null),
            OrderNotFoundByCodeException e      => (StatusCodes.Status404NotFound,    e.Message, null),
            ReturnOrderNotFoundException e      => (StatusCodes.Status404NotFound,    e.Message, null),
            PromotionNotFoundException e        => (StatusCodes.Status404NotFound,    e.Message, null),
            PaymentNotFoundException e          => (StatusCodes.Status404NotFound,    e.Message, null),
            OrderCannotBeCancelledException e   => (StatusCodes.Status409Conflict,    e.Message, null),
            OrderCannotBeModifiedException e    => (StatusCodes.Status409Conflict,    e.Message, null),
            DuplicateOrderCodeException e       => (StatusCodes.Status409Conflict,    e.Message, null),
            _                                   => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.", null)
        };

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var body = JsonSerializer.Serialize(
            new { error = message, message, statusCode, errors },
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

        return context.Response.WriteAsync(body);
    }
}
