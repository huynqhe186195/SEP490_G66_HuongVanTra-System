using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace HuongVanTra.Shared.Audit;

public static class SystemActivityAuditExtensions
{
    public static IServiceCollection AddHvtSystemActivityAudit(this IServiceCollection services, string serviceName)
    {
        services.Configure<SystemActivityAuditOptions>(options => options.ServiceName = serviceName);
        services.AddHttpContextAccessor();
        return services;
    }

    public static IApplicationBuilder UseHvtSystemActivityAudit(this IApplicationBuilder app) =>
        app.UseMiddleware<SystemActivityAuditMiddleware>();
}
