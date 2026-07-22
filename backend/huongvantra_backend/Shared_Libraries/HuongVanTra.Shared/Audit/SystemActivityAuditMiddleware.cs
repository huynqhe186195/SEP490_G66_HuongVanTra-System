using System.Security.Claims;
using HuongVanTra.Shared.Messages;
using MassTransit;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HuongVanTra.Shared.Audit;

public sealed class SystemActivityAuditMiddleware(
    RequestDelegate next,
    IOptions<SystemActivityAuditOptions> options,
    ILogger<SystemActivityAuditMiddleware> logger)
{
    private static readonly HashSet<string> SkippedMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "GET",
        "HEAD",
        "OPTIONS"
    };

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = ResolveCorrelationId(context);
        context.Response.Headers["X-Correlation-ID"] = correlationId;

        Exception? failure = null;
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            failure = ex;
            throw;
        }
        finally
        {
            await PublishActivityAsync(context, correlationId, failure);
        }
    }

    private async Task PublishActivityAsync(HttpContext context, string correlationId, Exception? failure)
    {
        if (ShouldSkip(context)) return;

        var publisher = context.RequestServices.GetService<IPublishEndpoint>();
        if (publisher is null)
        {
            logger.LogDebug("Audit publisher is not registered for {ServiceName}.", options.Value.ServiceName);
            return;
        }

        var statusCode = failure is null ? context.Response.StatusCode : StatusCodes.Status500InternalServerError;
        var path = context.Request.Path.Value ?? string.Empty;
        var routeValues = context.Request.RouteValues;
        var user = context.User;

        var activity = new SystemActivityEvent(
            Guid.NewGuid(),
            DateTime.UtcNow,
            ResolveActorId(user),
            ResolveActorName(user),
            ResolveActorRole(user),
            options.Value.ServiceName,
            ResolveModule(path),
            $"{context.Request.Method} {path}",
            ResolveEntityType(path),
            routeValues.TryGetValue("id", out var id) ? id?.ToString() : null,
            ResolveEntityCode(context),
            ResolveDescription(context, statusCode),
            statusCode >= 400 || failure is not null ? "Failed" : "Success",
            SensitiveDataRedactor.Redact(failure?.Message ?? (statusCode >= 400 ? $"HTTP {statusCode}" : null)),
            null,
            null,
            correlationId,
            path,
            context.Request.Method,
            statusCode,
            context.Connection.RemoteIpAddress?.ToString(),
            SensitiveDataRedactor.Redact(context.Request.Headers.UserAgent.ToString()));

        try
        {
            await publisher.Publish(activity, CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "System activity publish failed for {ServiceName} {Path}.", options.Value.ServiceName, path);
        }
    }

    private static bool ShouldSkip(HttpContext context)
    {
        if (SkippedMethods.Contains(context.Request.Method)) return true;
        if (context.User?.Identity?.IsAuthenticated != true) return true;

        var path = context.Request.Path.Value ?? string.Empty;
        return path.Equals("/health", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase);
    }

    private static string ResolveCorrelationId(HttpContext context)
    {
        var value = context.Request.Headers["X-Correlation-ID"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(value)) return value.Trim();

        value = context.Request.Headers["X-Request-ID"].FirstOrDefault();
        return string.IsNullOrWhiteSpace(value) ? context.TraceIdentifier : value.Trim();
    }

    private static Guid? ResolveActorId(ClaimsPrincipal user)
    {
        var value = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        return Guid.TryParse(value, out var id) && id != Guid.Empty ? id : null;
    }

    private static string? ResolveActorName(ClaimsPrincipal user)
    {
        return FirstNonEmpty(
            user.FindFirstValue("full_name"),
            user.FindFirstValue("name"),
            user.FindFirstValue(ClaimTypes.Name));
    }

    private static string? ResolveActorRole(ClaimsPrincipal user)
    {
        return FirstNonEmpty(user.FindAll(ClaimTypes.Role).Select(claim => claim.Value).ToArray());
    }

    private static string ResolveModule(string path)
    {
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0) return "system";
        if (segments.Length >= 3 && segments[0].Equals("api", StringComparison.OrdinalIgnoreCase) && segments[1].Equals("v1", StringComparison.OrdinalIgnoreCase))
            return segments[2];
        if (segments[0].Equals("api", StringComparison.OrdinalIgnoreCase) && segments.Length >= 2)
            return segments[1];
        return segments[0];
    }

    private static string? ResolveEntityType(string path)
    {
        var module = ResolveModule(path);
        return string.IsNullOrWhiteSpace(module) ? null : module;
    }

    private static string? ResolveEntityCode(HttpContext context)
    {
        foreach (var key in new[] { "code", "requestCode", "orderCode", "productionCode", "skuCode" })
        {
            var value = context.Request.Query[key].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(value)) return SensitiveDataRedactor.Redact(value);
        }

        return null;
    }

    private static string ResolveDescription(HttpContext context, int statusCode) =>
        $"{context.Request.Method} {context.Request.Path} completed with HTTP {statusCode}.";

    private static string? FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            var text = value?.Trim();
            if (!string.IsNullOrWhiteSpace(text)) return text;
        }

        return null;
    }
}
