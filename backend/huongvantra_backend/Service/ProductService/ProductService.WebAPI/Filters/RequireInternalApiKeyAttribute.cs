using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ProductService.WebAPI.Filters;

/// <summary>
/// Cho phép: (1) service nội bộ với X-Internal-Api-Key, hoặc (2) user đã đăng nhập đạt FallbackPolicy.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequireInternalApiKeyAttribute : Attribute, IAsyncActionFilter
{
    public const string HeaderName = "X-Internal-Api-Key";

    /// <summary>Policy dùng khi không có internal key (gọi từ FE). Mặc định VIEW_CATALOG_ACCESS.</summary>
    public string FallbackPolicy { get; set; } = PermissionNames.ViewCatalogAccess;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var config = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var expected = config["InternalApi:Key"]?.Trim();

        if (!string.IsNullOrWhiteSpace(expected)
            && context.HttpContext.Request.Headers.TryGetValue(HeaderName, out var provided)
            && string.Equals(provided.ToString().Trim(), expected, StringComparison.Ordinal))
        {
            await next();
            return;
        }

        var user = context.HttpContext.User;
        if (user?.Identity?.IsAuthenticated == true)
        {
            if (string.IsNullOrWhiteSpace(FallbackPolicy))
            {
                await next();
                return;
            }

            var authZ = context.HttpContext.RequestServices.GetRequiredService<IAuthorizationService>();
            var authResult = await authZ.AuthorizeAsync(user, FallbackPolicy);
            if (authResult.Succeeded)
            {
                await next();
                return;
            }

            context.Result = new ForbidResult();
            return;
        }

        if (string.IsNullOrWhiteSpace(expected))
        {
            context.Result = new ObjectResult(new { message = "Internal API key chưa được cấu hình." })
            {
                StatusCode = StatusCodes.Status503ServiceUnavailable,
            };
            return;
        }

        context.Result = new UnauthorizedObjectResult(new { message = "Thiếu khóa nội bộ hoặc chưa đăng nhập." });
    }
}
