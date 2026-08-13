using HuongVanTra.Shared.Auth;
using HuongVanTra.Shared.Middlewares;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// Tăng giới hạn upload cho toàn gateway (cần cho contract import file)
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 20_000_000; // 20MB
});
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 20_000_000; // 20MB
});

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
