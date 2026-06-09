using HuongVanTra.Shared.Auth;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using ProductService.Application.Interfaces;
using ProductService.Application.UseCases;
using ProductService.Infrastructure.Data;
using ProductService.Infrastructure.Messaging;
using ProductService.Infrastructure.Repositories;
using ProductService.WebAPI.Middlewares;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddHvtJwtAuthentication(builder.Configuration);
builder.Services.AddHvtPermissionPolicies();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ProductDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)),
        mySqlOptions => mySqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null)));

builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<IProductSkuRepository, ProductSkuRepository>();
builder.Services.AddScoped<IProductEventPublisher, ProductEventPublisher>();
builder.Services.AddScoped<CategoryLogic>();
builder.Services.AddScoped<ProductLogic>();
builder.Services.AddScoped<ProductSkuLogic>();

builder.Services.AddMassTransit(x =>
{
    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMQ:Host"] ?? "rabbitmq", "/", h =>
        {
            h.Username(builder.Configuration["RabbitMQ:Username"] ?? "hvt");
            h.Password(builder.Configuration["RabbitMQ:Password"] ?? "hvtrabbit123");
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
