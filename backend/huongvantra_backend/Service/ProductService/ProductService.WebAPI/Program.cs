using HuongVanTra.Shared.Auth;
using HuongVanTra.Shared.Audit;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using ProductService.Application.Interfaces;
using ProductService.Application.UseCases;
using ProductService.Infrastructure.Data;
using ProductService.Infrastructure.Messaging;
using ProductService.Infrastructure.Repositories;
using ProductService.Infrastructure.Services;
using ProductService.Infrastructure.UseCases;
using ProductService.WebAPI.Middlewares;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddHvtJwtAuthentication(builder.Configuration);
builder.Services.AddHvtPermissionPolicies();
builder.Services.AddHvtSystemActivityAudit("ProductService");

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ProductDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)),
        mySqlOptions => mySqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null)));

builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<IBrandRepository, BrandRepository>();
builder.Services.AddScoped<IAttributeNameRepository, AttributeNameRepository>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<IPriceBookRepository, PriceBookRepository>();
builder.Services.AddScoped<IProductEventPublisher, ProductEventPublisher>();
builder.Services.AddScoped<ISupplierReceiptCostStore, SupplierReceiptCostStore>();
builder.Services.AddHttpClient<IInventoryProductDeletionValidationClient, InventoryProductDeletionValidationClient>(client =>
{
    var baseUrl = builder.Configuration["InventoryService:BaseUrl"] ?? "http://inventory-service:8080";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
});
builder.Services.AddHttpClient<IInventorySupplierReceiptCostClient, InventorySupplierReceiptCostClient>(client =>
{
    var baseUrl = builder.Configuration["InventoryService:BaseUrl"] ?? "http://inventory-service:8080";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
});
// Consumer được dùng lại ngoài luồng message để re-evaluate các receipt group
// đang treo reconciliation_required. MassTransit cũng TryAddScoped cùng type.
builder.Services.AddScoped<SupplierReceiptApprovedCostRecordedConsumer>();
builder.Services.AddScoped<ICostBasisReconciliationService, CostBasisReconciliationService>();
builder.Services.AddHttpClient<ICloudinaryImageService, CloudinaryImageService>();
builder.Services.AddScoped<IAdminNotificationSender, SmtpAdminNotificationSender>();
builder.Services.AddScoped<CategoryLogic>();
builder.Services.AddScoped<BrandLogic>();
builder.Services.AddScoped<AttributeNameLogic>();
builder.Services.AddScoped<ProductLogic>();
builder.Services.AddScoped<ProductSkuLogic>();
builder.Services.AddScoped<ProductApprovalLogic>();
builder.Services.AddScoped<ProductCreationRequestLogic>();
builder.Services.AddScoped<ProductDeletionRequestLogic>();
builder.Services.AddScoped<RetailPriceChangeRequestLogic>();
builder.Services.AddScoped<NotificationLogic>();
builder.Services.AddScoped<PriceBookLogic>();
builder.Services.AddScoped<CatalogSyncLogic>();

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<CostPriceUpdatedConsumer>();
    x.AddConsumer<SupplierReceiptApprovedCostRecordedConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMQ:Host"] ?? "rabbitmq", "/", h =>
        {
            h.Username(builder.Configuration["RabbitMQ:Username"] ?? "hvt");
            h.Password(builder.Configuration["RabbitMQ:Password"] ?? throw new InvalidOperationException("RabbitMQ:Password chua duoc cau hinh"));
        });

        cfg.ReceiveEndpoint("product-cost-price-updated", e =>
        {
            e.ConfigureConsumer<CostPriceUpdatedConsumer>(context);
        });

        cfg.ReceiveEndpoint("product-service.supplier-receipt-approved-cost-recorded", e =>
        {
            e.ConfigureConsumer<SupplierReceiptApprovedCostRecordedConsumer>(context);
        });
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ProductDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var migrated = false;
    for (var retry = 1; retry <= 10; retry++)
    {
        try
        {
            db.Database.Migrate();
            migrated = true;
            break;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Migration attempt {Retry}/10 failed. Retrying in 5s...", retry);
            Thread.Sleep(5000);
        }
    }

    if (!migrated)
    {
        throw new InvalidOperationException("Product database migration failed after 10 attempts.");
    }

    try
    {
        var costFix = scope.ServiceProvider.GetRequiredService<ICostBasisReconciliationService>();
        var retry = costFix.RetryPendingReconciliationAsync(CancellationToken.None)
            .GetAwaiter()
            .GetResult();
        if (retry.SkuCount > 0)
        {
            logger.LogInformation(
                "Retried pending supplier-receipt cost groups after startup. SkuCount={SkuCount} Reapplied={Reapplied} Deferred={Deferred}",
                retry.SkuCount,
                retry.ReappliedCount,
                retry.DeferredCount);
        }
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Startup retry of pending cost reconciliation failed; use POST /api/v1/products/cost-basis-reconciliation/retry-pending.");
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
