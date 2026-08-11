using CustomerService.Application.Interfaces;
using CustomerService.Application.UseCases;
using CustomerService.Infrastructure.Data;
using CustomerService.Infrastructure.Messaging;
using CustomerService.Infrastructure.Repositories;
using CustomerService.WebAPI.Middlewares;
using HuongVanTra.Shared.Audit;
using HuongVanTra.Shared.Auth;
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

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<CustomerDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)),
        mySqlOptions => mySqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null)));

builder.Services.AddScoped<ICustomerRepository, CustomerRepository>();
builder.Services.AddScoped<ICustomerTierRepository, CustomerTierRepository>();
builder.Services.AddScoped<ICustomerAddressRepository, CustomerAddressRepository>();
builder.Services.AddScoped<IProcessedIntegrationEventRepository, ProcessedIntegrationEventRepository>();
builder.Services.AddScoped<ICustomerDebtTransactionRepository, CustomerDebtTransactionRepository>();
builder.Services.AddScoped<ICustomerDebtAllocationRepository, CustomerDebtAllocationRepository>();
builder.Services.AddScoped<ICustomerActivityRepository, CustomerActivityRepository>();
builder.Services.AddScoped<ICustomerOutboxWriter, CustomerOutboxWriter>();
builder.Services.AddScoped<CustomerLogic>();
builder.Services.AddScoped<CustomerTierLogic>();
builder.Services.AddHostedService<CustomerOutboxDispatcherHostedService>();

builder.Services.AddHvtJwtAuthentication(builder.Configuration);
builder.Services.AddHvtPermissionPolicies();
builder.Services.AddHvtSystemActivityAudit("CustomerService");

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<OrderCompletedConsumer>();
    x.AddConsumer<OrderReturnedConsumer>();

    x.UsingRabbitMq((ctx, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMQ:Host"], h =>
        {
            h.Username(builder.Configuration["RabbitMQ:Username"] ?? "guest");
            h.Password(builder.Configuration["RabbitMQ:Password"] ?? "guest");
        });

        cfg.ReceiveEndpoint("customer-service.order-completed", e =>
        {
            e.ConfigureConsumer<OrderCompletedConsumer>(ctx);
        });

        cfg.ReceiveEndpoint("customer-service.order-returned", e =>
        {
            e.ConfigureConsumer<OrderReturnedConsumer>(ctx);
        });
    });
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        if (origins.Length > 0)
            policy.WithOrigins(origins).AllowAnyMethod().AllowAnyHeader();
        else
            policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CustomerDbContext>();
    var retries = 0;
    while (retries < 10)
    {
        try
        {
            db.Database.Migrate();
            await CustomerDataSeeder.SeedAsync(db);
            break;
        }
        catch (Exception ex)
        {
            retries++;
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
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
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseHvtSystemActivityAudit();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
app.MapControllers();

app.Run();
