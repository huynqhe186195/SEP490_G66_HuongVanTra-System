using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace InventoryService.WebAPI.Filters;

/// <summary>
/// Chỉ cho phép gọi service-to-service bằng header X-Internal-Api-Key.
/// Không có fallback theo user: endpoint gắn attribute này không dành cho frontend.
/// Đi kèm [AllowAnonymous] vì authorization middleware chạy trước action filter.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequireInternalApiKeyAttribute : Attribute, IAsyncActionFilter
{
    public const string HeaderName = "X-Internal-Api-Key";

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var expected = context.HttpContext.RequestServices
            .GetRequiredService<IConfiguration>()["InternalApi:Key"]?.Trim();

        if (string.IsNullOrWhiteSpace(expected))
        {
            context.Result = new ObjectResult(new { message = "Internal API key chưa được cấu hình." })
            {
                StatusCode = StatusCodes.Status503ServiceUnavailable,
            };
            return;
        }

        context.HttpContext.Request.Headers.TryGetValue(HeaderName, out var provided);

        if (!IsMatch(provided.ToString(), expected))
        {
            context.Result = new UnauthorizedObjectResult(new { message = "Thiếu hoặc sai khóa nội bộ." });
            return;
        }

        await next();
    }

    private static bool IsMatch(string? provided, string expected)
    {
        if (string.IsNullOrWhiteSpace(provided))
            return false;

        var a = Encoding.UTF8.GetBytes(provided.Trim());
        var b = Encoding.UTF8.GetBytes(expected);
        return CryptographicOperations.FixedTimeEquals(a, b);
    }
}
