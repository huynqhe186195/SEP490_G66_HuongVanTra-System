using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace InventoryService.WebAPI.Filters;

/// <summary>
/// Chỉ cho phép service nội bộ với header X-Internal-Api-Key khớp InternalApi:Key.
/// Dùng cho endpoint mutation S2S (không JWT fallback).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequireInternalApiKeyAttribute : Attribute, IAsyncActionFilter
{
    public const string HeaderName = "X-Internal-Api-Key";

    public Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var config = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var expected = config["InternalApi:Key"]?.Trim();

        if (string.IsNullOrWhiteSpace(expected))
        {
            context.Result = new ObjectResult(new { message = "Internal API key chưa được cấu hình." })
            {
                StatusCode = StatusCodes.Status503ServiceUnavailable,
            };
            return Task.CompletedTask;
        }

        if (context.HttpContext.Request.Headers.TryGetValue(HeaderName, out var provided)
            && string.Equals(provided.ToString().Trim(), expected, StringComparison.Ordinal))
        {
            return next();
        }

        context.Result = new UnauthorizedObjectResult(new { message = "Thiếu hoặc sai khóa nội bộ." });
        return Task.CompletedTask;
    }
}
