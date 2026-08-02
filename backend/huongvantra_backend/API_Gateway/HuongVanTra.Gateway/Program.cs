using HuongVanTra.Shared.Auth;
using HuongVanTra.Shared.Middlewares;
using Microsoft.AspNetCore.Authorization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

builder.Services.AddHvtJwtAuthentication(builder.Configuration);
builder.Services.AddAuthorization(options =>
{
    // Mọi route qua Gateway mặc định cần đăng nhập, trừ route gắn AuthorizationPolicy = Anonymous.
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        policy.WithOrigins(origins).AllowAnyMethod().AllowAnyHeader();
    });
});

var app = builder.Build();

app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapReverseProxy();

app.Run();
