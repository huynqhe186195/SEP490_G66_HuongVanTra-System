using System.Text.Json;
using InventoryService.Domain.Exceptions;

namespace InventoryService.WebAPI.Middlewares;

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
        context.Response.ContentType = "application/json";

        if (ex is InsufficientStockException stockEx)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            var body = JsonSerializer.Serialize(new
            {
                code = "INSUFFICIENT_STOCK",
                message = stockEx.Message,
                shortages = stockEx.Shortages.Select(s => new
                {
                    materialId = s.SkuId,
                    productId = s.SkuId,
                    materialName = s.SkuName,
                    requiredQuantity = s.RequiredQuantity,
                    availableQuantity = s.AvailableQuantity,
                    shortageQuantity = s.ShortageQuantity
                })
            }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            return context.Response.WriteAsync(body);
        }

        if (ex is DuplicateStockAdjustmentRequestException duplicateEx)
        {
            context.Response.StatusCode = StatusCodes.Status409Conflict;
            var body = JsonSerializer.Serialize(new
            {
                code = "DUPLICATE_STOCK_ADJUSTMENT_SKU",
                message = duplicateEx.Message,
                blocking = duplicateEx.Blocking,
                duplicates = duplicateEx.Duplicates
            }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            return context.Response.WriteAsync(body);
        }

        var (statusCode, message) = ex switch
        {
            InventoryNotFoundException e => (StatusCodes.Status404NotFound, e.Message),
            InventoryValidationException e => (StatusCodes.Status400BadRequest, e.Message),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.")
        };

        context.Response.StatusCode = statusCode;
        return context.Response.WriteAsync(JsonSerializer.Serialize(
            new { message, statusCode },
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
    }
}
