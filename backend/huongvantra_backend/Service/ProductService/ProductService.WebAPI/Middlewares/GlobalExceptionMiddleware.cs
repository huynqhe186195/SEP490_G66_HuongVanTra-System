using System.Text.Json;
using Microsoft.AspNetCore.Http;
using ProductService.Domain.Exceptions;

namespace ProductService.WebAPI.Middlewares;

public class GlobalExceptionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        var (statusCode, message) = ex switch
        {
            ProductNotFoundException e => (StatusCodes.Status404NotFound, e.Message),
            ProductSkuNotFoundException e => (StatusCodes.Status404NotFound, e.Message),
            ProductSkuNotFoundByCodeException e => (StatusCodes.Status404NotFound, e.Message),
            CategoryNotFoundException e => (StatusCodes.Status404NotFound, e.Message),
            DuplicateSkuCodeException e => (StatusCodes.Status409Conflict, e.Message),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.")
        };

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var response = JsonSerializer.Serialize(
            new { status = statusCode, message },
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

        return context.Response.WriteAsync(response);
    }
}
