using HuongVanTra.Shared.Auth;
using HuongVanTra.Shared.Audit;
using InventoryService.Application.Interfaces;
using InventoryService.Application.Options;
using InventoryService.Application.UseCases;
using InventoryService.Infrastructure.Data;
using InventoryService.Infrastructure.Messaging;
using InventoryService.Infrastructure.Repositories;
using InventoryService.Infrastructure.Services;
using InventoryService.WebAPI.Middlewares;
using InventoryService.WebAPI.Services;
using MassTransit;
using Microsoft.EntityFrameworkCore;
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
builder.Services.AddHvtSystemActivityAudit("InventoryService");
builder.Services.Configure<InventoryOptions>(builder.Configuration.GetSection(InventoryOptions.SectionName));

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<InventoryDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)),
        mySqlOptions => mySqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null)));

builder.Services.AddScoped<IInventoryUnitOfWork, InventoryUnitOfWork>();
builder.Services.AddScoped<ISkuStockRepository, SkuStockRepository>();
builder.Services.AddScoped<IStockDeductQueueRepository, StockDeductQueueRepository>();
builder.Services.AddScoped<IStockAdjustmentRequestRepository, StockAdjustmentRequestRepository>();
builder.Services.AddScoped<IStockTransferRepository, StockTransferRepository>();
builder.Services.AddScoped<IStockExportSlipRepository, StockExportSlipRepository>();
builder.Services.AddScoped<IStockImportSlipRepository, StockImportSlipRepository>();
builder.Services.AddScoped<IWarehouseBatchRepository, WarehouseBatchRepository>();
builder.Services.AddScoped<IStockExportBatchAllocationRepository, StockExportBatchAllocationRepository>();
builder.Services.AddScoped<IInventoryLedgerRepository, InventoryLedgerRepository>();
builder.Services.AddScoped<ISupplierReceiptRepository, SupplierReceiptRepository>();
builder.Services.AddScoped<IShelfReturnRequestRepository, ShelfReturnRequestRepository>();
builder.Services.AddScoped<ISupplierReturnRequestRepository, SupplierReturnRequestRepository>();
builder.Services.AddScoped<IStocktakeRequestRepository, StocktakeRequestRepository>();
builder.Services.AddScoped<IProcessedIntegrationEventRepository, ProcessedIntegrationEventRepository>();
builder.Services.AddScoped<IProductionOrderRepository, ProductionOrderRepository>();
builder.Services.AddScoped<ISupplierRepository, SupplierRepository>();
builder.Services.AddScoped<ISupplierProductRepository, SupplierProductRepository>();
builder.Services.AddScoped<IReturnInspectionRepository, ReturnInspectionRepository>();
builder.Services.AddScoped<IInventoryEventPublisher, InventoryEventPublisher>();
builder.Services.AddHttpClient<IProductCatalogClient, ProductCatalogClient>(client =>
{
    var baseUrl = builder.Configuration["ProductService:BaseUrl"] ?? "http://product-service:8080";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
});
builder.Services.AddScoped<InventoryLogic>();
builder.Services.AddScoped<StockTransferLogic>();
builder.Services.AddScoped<StatisticsLogic>();
builder.Services.AddHostedService<InventoryOutboxDispatcherHostedService>();
builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<SkuCreatedConsumer>();
    x.AddConsumer<OrderPlacedConsumer>();
    x.AddConsumer<OrderCancelledConsumer>();
    x.AddConsumer<OrderReturnedConsumer>();
    x.AddConsumer<OrderShippedConsumer>();
    x.AddConsumer<LowStockConsumer>();

    x.UsingRabbitMq((ctx, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMQ:Host"] ?? "rabbitmq", "/", h =>
        {
            h.Username(builder.Configuration["RabbitMQ:Username"] ?? "hvt");
            h.Password(builder.Configuration["RabbitMQ:Password"] ?? "hvtrabbit123");
        });

        cfg.ReceiveEndpoint("inventory-service.sku-created", e =>
            e.ConfigureConsumer<SkuCreatedConsumer>(ctx));

        cfg.ReceiveEndpoint("inventory-service.order-placed", e =>
            e.ConfigureConsumer<OrderPlacedConsumer>(ctx));

        cfg.ReceiveEndpoint("inventory-service.order-cancelled", e =>
            e.ConfigureConsumer<OrderCancelledConsumer>(ctx));

        cfg.ReceiveEndpoint("inventory-service.order-returned", e =>
            e.ConfigureConsumer<OrderReturnedConsumer>(ctx));

        cfg.ReceiveEndpoint("inventory-service.order-shipped", e =>
            e.ConfigureConsumer<OrderShippedConsumer>(ctx));

        cfg.ReceiveEndpoint("inventory-service.low-stock", e =>
            e.ConfigureConsumer<LowStockConsumer>(ctx));
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<InventoryDbContext>();
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
