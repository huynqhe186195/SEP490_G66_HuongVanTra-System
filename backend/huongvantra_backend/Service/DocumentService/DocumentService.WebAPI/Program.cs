using DocumentService.Application.Interfaces;
using DocumentService.Application.Models;
using DocumentService.Application.UseCases;
using DocumentService.Infrastructure.Data;
using DocumentService.Infrastructure.Repositories;
using DocumentService.Infrastructure.Services;
using DocumentService.WebAPI.Middlewares;
using HuongVanTra.Shared.Audit;
using HuongVanTra.Shared.Auth;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddHvtJwtAuthentication(builder.Configuration);
builder.Services.AddHvtPermissionPolicies();
builder.Services.AddHvtSystemActivityAudit("DocumentService");

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<DocumentDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)),
        mySqlOptions => mySqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null)));

builder.Services.AddScoped<IContractRepository, ContractRepository>();
builder.Services.AddScoped<ContractLogic>();
builder.Services.AddScoped<IContractDocxParser, ContractDocxParser>();
builder.Services.AddScoped<IContractPdfParser, ContractPdfParser>();
builder.Services.AddHostedService<DocumentService.WebAPI.Services.ContractExpiryHostedService>();

builder.Services.Configure<SellerProfileOptions>(builder.Configuration.GetSection("SellerProfile"));
builder.Services.AddSingleton(sp => sp.GetRequiredService<IOptions<SellerProfileOptions>>().Value);
builder.Services.AddKeyedSingleton<IContractDocumentGenerator, ContractDocxGenerator>("docx");
builder.Services.AddKeyedSingleton<IContractDocumentGenerator, ContractPdfGenerator>("pdf");

builder.Services.AddHttpContextAccessor();
builder.Services.AddTransient<ForwardAuthorizationHeaderHandler>();
builder.Services.AddHttpClient<ICustomerCatalogClient, CustomerCatalogClient>(client =>
{
    var baseUrl = builder.Configuration["CustomerService:BaseUrl"] ?? "http://customer-service:8080";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
}).AddHttpMessageHandler<ForwardAuthorizationHeaderHandler>();

builder.Services.AddHttpClient<IProductCatalogClient, ProductCatalogClient>(client =>
{
    var baseUrl = builder.Configuration["ProductService:BaseUrl"] ?? "http://product-service:8080";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
    var internalKey = builder.Configuration["InternalApi:Key"];
    if (!string.IsNullOrWhiteSpace(internalKey))
        client.DefaultRequestHeaders.TryAddWithoutValidation("X-Internal-Api-Key", internalKey);
});

builder.Services.AddMassTransit(x =>
{
    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMQ:Host"] ?? "rabbitmq", "/", h =>
        {
            h.Username(builder.Configuration["RabbitMQ:Username"] ?? "hvt");
            h.Password(builder.Configuration["RabbitMQ:Password"] ?? throw new InvalidOperationException("RabbitMQ:Password chua duoc cau hinh"));
        });
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<DocumentDbContext>();
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
// Contract Management is outside the current release scope. The service is
// excluded from docker-compose/Gateway; this also protects a manually started instance.
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api/contracts"))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    await next();
});
app.UseAuthentication();
app.UseAuthorization();
app.UseHvtSystemActivityAudit();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
app.MapControllers();

app.Run();

public sealed class ForwardAuthorizationHeaderHandler(IHttpContextAccessor httpContextAccessor) : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var authorization = httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrWhiteSpace(authorization))
            request.Headers.TryAddWithoutValidation("Authorization", authorization);

        return base.SendAsync(request, cancellationToken);
    }
}
