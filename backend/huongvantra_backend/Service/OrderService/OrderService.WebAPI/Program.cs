using MassTransit;
using HuongVanTra.Shared.Messages;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Application.UseCases;
using OrderService.Infrastructure.Data;
using OrderService.Infrastructure.Messaging;
using OrderService.Infrastructure.Repositories;
using OrderService.Infrastructure.Services;
using OrderService.WebAPI.Services;
using OrderService.WebAPI.Middlewares;
using HuongVanTra.Shared.Auth;
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

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<OrderDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)),
        mySqlOptions => mySqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null)));

builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IOrderDetailRepository, OrderDetailRepository>();
builder.Services.AddScoped<IPaymentRepository, PaymentRepository>();
builder.Services.AddScoped<IOrderActivityRepository, OrderActivityRepository>();
builder.Services.AddScoped<IPromotionRepository, PromotionRepository>();
builder.Services.AddScoped<IOrderCodeGenerator, OrderCodeGenerator>();
builder.Services.AddScoped<IReturnOrderRepository, ReturnOrderRepository>();
builder.Services.AddScoped<IOrderEventPublisher, OrderEventPublisher>();
builder.Services.AddScoped<IReportRepository, ReportRepository>();
builder.Services.Configure<PosTransferPaymentOptions>(
    builder.Configuration.GetSection(PosTransferPaymentOptions.SectionName));
builder.Services.Configure<SepayOptions>(
    builder.Configuration.GetSection(SepayOptions.SectionName));

builder.Services.AddScoped<OrderLogic>();
builder.Services.AddScoped<PaymentLogic>();
builder.Services.AddScoped<PosTransferPaymentLogic>();
builder.Services.AddScoped<PromotionLogic>();
builder.Services.AddScoped<CodReminderLogic>();
builder.Services.AddHostedService<CodReminderHostedService>();
builder.Services.AddScoped<IReportLogic, ReportLogic>();

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<StockDeductedConsumer>();

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
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
app.MapControllers();

app.Run();
