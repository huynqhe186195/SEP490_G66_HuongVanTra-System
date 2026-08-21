using MassTransit;
using HuongVanTra.Shared.Messages;
using HuongVanTra.Shared.Notifications;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Application.Services;
using OrderService.Application.UseCases;
using OrderService.Infrastructure.Data;
using OrderService.Infrastructure.Messaging;
using OrderService.Infrastructure.Repositories;
using OrderService.Infrastructure.Services;
using OrderService.WebAPI.Services;
using OrderService.WebAPI.Middlewares;
using HuongVanTra.Shared.Auth;
using HuongVanTra.Shared.Audit;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        // Accept PascalCase from frontend (matching C# DTO properties)
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddHvtJwtAuthentication(builder.Configuration);
builder.Services.AddHvtPermissionPolicies();
builder.Services.AddHvtSystemActivityAudit("OrderService");

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<OrderDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)),
        mySqlOptions => mySqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null)));

builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IPaymentIdempotencyRepository, PaymentIdempotencyRepository>();
builder.Services.AddScoped<PaymentIdempotencyService>();
builder.Services.AddScoped<IOrderDetailRepository, OrderDetailRepository>();
builder.Services.AddScoped<IPaymentRepository, PaymentRepository>();
builder.Services.AddScoped<IOrderActivityRepository, OrderActivityRepository>();
builder.Services.AddScoped<IOrderReceiptPrintLogRepository, OrderReceiptPrintLogRepository>();
builder.Services.AddScoped<IPromotionRepository, PromotionRepository>();
builder.Services.AddScoped<IOrderCodeGenerator, OrderCodeGenerator>();
builder.Services.AddScoped<IReturnOrderRepository, ReturnOrderRepository>();
builder.Services.AddScoped<IReturnPolicyRepository, ReturnPolicyRepository>();
builder.Services.AddScoped<ICustomBundleRepository, CustomBundleRepository>();
builder.Services.AddScoped<IOrderOutboxWriter, OrderOutboxWriter>();
// G4: request path ghi integration event vào Outbox (atomic với business transaction),
// thay cho publish trực tiếp RabbitMQ. Dispatcher nền (G5) sẽ publish sau khi commit.
builder.Services.AddScoped<IOrderEventPublisher, OutboxOrderEventPublisher>();
// G5: Outbox Dispatcher — background publisher đọc Outbox và publish lên RabbitMQ.
builder.Services.Configure<OutboxDispatcherOptions>(
    builder.Configuration.GetSection(OutboxDispatcherOptions.SectionName));
builder.Services.AddScoped<IOutboxStore, OutboxStore>();
builder.Services.AddScoped<IOutboxMessagePublisher, MassTransitOutboxMessagePublisher>();
builder.Services.AddScoped<OutboxDispatchProcessor>();
builder.Services.AddHostedService<OutboxDispatcherHostedService>();
// G7: giám sát Outbox (liệt kê/chi tiết/thống kê/retry thủ công) cho trang quản trị đồng bộ tồn kho.
builder.Services.AddScoped<IOutboxMonitoringRepository, OutboxMonitoringRepository>();
builder.Services.AddScoped<IOutboxMonitoringLogic, OutboxMonitoringLogic>();
builder.Services.AddScoped<IReportRepository, ReportRepository>();
builder.Services.AddScoped<IEndOfDayReportRepository, EndOfDayReportRepository>();
builder.Services.AddScoped<IPosCashSessionRepository, PosCashSessionRepository>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddTransient<ForwardAuthorizationHeaderHandler>();
builder.Services.AddHttpClient<IProductCatalogClient, ProductCatalogClient>(client =>
{
    var baseUrl = builder.Configuration["ProductService:BaseUrl"] ?? "http://product-service:8080";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
    var internalKey = builder.Configuration["InternalApi:Key"];
    if (!string.IsNullOrWhiteSpace(internalKey))
        client.DefaultRequestHeaders.TryAddWithoutValidation("X-Internal-Api-Key", internalKey);
});
builder.Services.AddHttpClient<ICustomerCatalogClient, CustomerCatalogClient>(client =>
{
    var baseUrl = builder.Configuration["CustomerService:BaseUrl"] ?? "http://customer-service:8080";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
}).AddHttpMessageHandler<ForwardAuthorizationHeaderHandler>();
// B2B / DocumentService out of current release scope — no HTTP dependency on document-service.
builder.Services.AddSingleton<IContractCatalogClient, DisabledContractCatalogClient>();
builder.Services.AddHttpClient<IInventoryCatalogClient, InventoryCatalogClient>(client =>
{
    var baseUrl = builder.Configuration["InventoryService:BaseUrl"] ?? "http://inventory-service:8080";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
}).AddHttpMessageHandler<ForwardAuthorizationHeaderHandler>();
builder.Services.AddHttpClient<IShiftCatalogClient, ShiftCatalogClient>(client =>
{
    var baseUrl = builder.Configuration["UserService:BaseUrl"] ?? "http://user-service:8080";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
}).AddHttpMessageHandler<ForwardAuthorizationHeaderHandler>();

builder.Services.AddHttpClient<INotificationClient, NotificationClient>(client =>
{
    var baseUrl = builder.Configuration["ProductService:BaseUrl"] ?? "http://product-service:8080";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
});

builder.Services.AddSingleton<ServiceJwtProvider>();
builder.Services.Configure<PosTransferPaymentOptions>(
    builder.Configuration.GetSection(PosTransferPaymentOptions.SectionName));
builder.Services.Configure<SepayOptions>(
    builder.Configuration.GetSection(SepayOptions.SectionName));
builder.Services.Configure<BackorderOptions>(
    builder.Configuration.GetSection(BackorderOptions.SectionName));

builder.Services.Configure<EmailOptions>(options => 
{
    options.SmtpHost = builder.Configuration["SMTP_HOST"] ?? "";
    options.SmtpPort = int.TryParse(builder.Configuration["SMTP_PORT"], out var port) ? port : 587;
    options.SmtpUser = builder.Configuration["SMTP_USER"] ?? "";
    options.SmtpPass = builder.Configuration["SMTP_PASS"] ?? "";
    options.DemoEmailOverride = builder.Configuration["DEMO_EMAIL_OVERRIDE"];
});
builder.Services.AddScoped<IEmailService, EmailService>();

builder.Services.AddScoped<OrderService.Application.Authorization.StaffShiftGuard>();
builder.Services.AddScoped<PosCashSessionLogic>();
builder.Services.AddScoped<OrderLogic>();
builder.Services.AddScoped<ReturnPolicyLogic>();
builder.Services.AddScoped<ReceiptReprintLogic>();
builder.Services.AddScoped<PaymentLogic>();
builder.Services.AddScoped<PosTransferPaymentLogic>();
builder.Services.AddScoped<PromotionLogic>();
builder.Services.AddScoped<CodReminderLogic>();
builder.Services.AddHostedService<CodReminderHostedService>();
builder.Services.AddScoped<IReportLogic, ReportLogic>();
builder.Services.AddScoped<IEndOfDayReportLogic, EndOfDayReportLogic>();

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<StockDeductedConsumer>();
    x.AddConsumer<CustomerTierUpgradedConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMQ:Host"] ?? "rabbitmq", "/", h =>
        {
            h.Username(builder.Configuration["RabbitMQ:Username"] ?? "hvt");
            h.Password(builder.Configuration["RabbitMQ:Password"] ?? "hvtrabbit123");
        });

        cfg.ReceiveEndpoint("order-service.stock-deducted", e =>
        {
            e.ConfigureConsumer<StockDeductedConsumer>(context);
        });
        cfg.ReceiveEndpoint("order-service.customer-tier-upgraded", e =>
        {
            e.ConfigureConsumer<CustomerTierUpgradedConsumer>(context);
        });
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OrderDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var retries = 0;
    while (retries < 10)
    {
        try { db.Database.Migrate(); break; }
        catch (Exception ex)
        {
            retries++;
            logger.LogWarning("Migration attempt {Retry}/10 failed: {Message}. Retrying in 5s...", retries, ex.Message);
            Thread.Sleep(5000);
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.UseHvtSystemActivityAudit();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
app.MapControllers();

app.Run();

public sealed class ServiceJwtProvider(IConfiguration configuration)
{
    private readonly string _secret = configuration["Jwt:Secret"]
        ?? configuration["Jwt:Key"]
        ?? throw new InvalidOperationException("Jwt:Secret is missing.");
    private readonly string _issuer = configuration["Jwt:Issuer"] ?? "HuongVanTra";
    private readonly string _audience = configuration["Jwt:Audience"] ?? "HuongVanTra";

    public string Generate(params string[] permissions)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = permissions
            .Select(p => new Claim("permission", p))
            .Append(new Claim(JwtRegisteredClaimNames.Sub, Guid.Empty.ToString()))
            .ToList();
        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(5),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public sealed class ForwardAuthorizationHeaderHandler(
    IHttpContextAccessor httpContextAccessor,
    ServiceJwtProvider serviceJwtProvider) : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var authorization = httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrWhiteSpace(authorization)
            && authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            request.Headers.TryAddWithoutValidation("Authorization", authorization);
        }
        else
        {
            var serviceToken = serviceJwtProvider.Generate(PermissionNames.CreateOrder, PermissionNames.ViewAllCustomers);
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {serviceToken}");
        }
        return base.SendAsync(request, cancellationToken);
    }
}
