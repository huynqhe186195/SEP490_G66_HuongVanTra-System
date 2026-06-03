using HuongVanTra.API.Authorization;
using HuongVanTra.Core.Authorization;
using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Core.Interfaces;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Infrastructure.Repositories;
using HuongVanTra.Service.Auth;
using HuongVanTra.Service.Employees;
using HuongVanTra.Service.Implementations;
using HuongVanTra.Service.Interfaces;
using HuongVanTra.Service.Orders;
using HuongVanTra.Service.Profile;
using HuongVanTra.Service.Sales;
using Microsoft.Extensions.DependencyInjection;
using HuongVanTra.Service.Staff;
using HuongVanTra.Service.Users;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Text.Json;
using CustomerModuleService = HuongVanTra.Service.Customers.ICustomerService;
using CustomerModuleServiceImpl = HuongVanTra.Service.Customers.CustomerService;
using MembershipCustomerService = HuongVanTra.Service.Interfaces.ICustomerService;
using MembershipCustomerServiceImpl = HuongVanTra.Service.Implementations.CustomerService;

namespace HuongVanTra.API
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

            builder.Services.AddScoped<IAuthService, AuthService>();
            builder.Services.AddScoped<IProfileService, ProfileService>();
            builder.Services.AddScoped<IStaffAccountService, StaffAccountService>();
            builder.Services.AddScoped<IOrderService, OrderService>();
            builder.Services.AddScoped<IOrderConfirmationService, OrderConfirmationService>();
            builder.Services.Configure<VietQrTransferSettings>(
                builder.Configuration.GetSection(VietQrTransferSettings.SectionName));
            builder.Services.AddHttpClient<IVietQrService, VietQrService>();
            builder.Services.AddHttpClient<ISepayOrderVaService, SepayOrderVaService>();
            builder.Services.AddScoped<IPosOrderService, PosOrderService>();
            builder.Services.AddScoped<IOnlineOrderService, OnlineOrderService>();
            builder.Services.AddScoped<IStockDeductQueueService, StockDeductQueueService>();
            builder.Services.Configure<SepaySettings>(
                builder.Configuration.GetSection(SepaySettings.SectionName));
            builder.Services.AddScoped<IPaymentWebhookService, PaymentWebhookService>();
            builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

            builder.Services.AddScoped<IEmployeeService, EmployeeService>();
            builder.Services.AddScoped<IUserAccountService, UserAccountService>();
            builder.Services.AddScoped<CustomerModuleService, CustomerModuleServiceImpl>();
            builder.Services.AddScoped<MembershipCustomerService, MembershipCustomerServiceImpl>();

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("Frontend", policy =>
                {
                    policy.WithOrigins(
                            "http://localhost:5173",
                            "http://127.0.0.1:5173",
                            "http://localhost:4173")
                        .AllowAnyHeader()
                        .AllowAnyMethod();
                });
            });

            builder.Services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
            builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
            builder.Services.AddScoped<IInventoryService, InventoryService>();
            builder.Services.AddScoped<IProductionService, ProductionService>();

            builder.Services.AddControllers();
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(options =>
            {
                options.SwaggerDoc("v1", new OpenApiInfo { Title = "HuongVanTra.API", Version = "v1" });
                options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    Name = "Authorization",
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                    In = ParameterLocation.Header,
                    Description = "Nhập token theo định dạng: Bearer {token}"
                });
                options.AddSecurityRequirement(new OpenApiSecurityRequirement {
                    {
                        new OpenApiSecurityScheme {
                            Reference = new OpenApiReference {
                                Type = ReferenceType.SecurityScheme,
                                Id = "Bearer"
                            }
                        },
                        Array.Empty<string>()
                    }
                });
            });

            var jwtKey = builder.Configuration["Jwt:Key"];
            var jwtIssuer = builder.Configuration["Jwt:Issuer"];
            var jwtAudience = builder.Configuration["Jwt:Audience"];

            if (string.IsNullOrWhiteSpace(jwtKey) || string.IsNullOrWhiteSpace(jwtIssuer) || string.IsNullOrWhiteSpace(jwtAudience))
            {
                throw new InvalidOperationException(
                    "JWT configuration is missing. Add Jwt:Key, Jwt:Issuer, and Jwt:Audience to appsettings.json (or user secrets / environment variables).");
            }

            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.MapInboundClaims = false;
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = jwtIssuer,
                        ValidAudience = jwtAudience,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                        RoleClaimType = AppClaims.Role,
                        NameClaimType = JwtRegisteredClaimNames.UniqueName,
                    };
                });

            builder.Services.AddAppAuthorization();

            var app = builder.Build();

            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            if (!app.Environment.IsDevelopment())
            {
                app.UseHttpsRedirection();
            }

            app.UseCors("Frontend");

            app.UseAuthentication();
            app.UseAuthorization();

            app.Use(async (context, next) =>
            {
                await next();

                if (context.Response.HasStarted)
                {
                    return;
                }

                if (context.Response.StatusCode == StatusCodes.Status401Unauthorized)
                {
                    context.Response.ContentType = "application/json";
                    var payload = JsonSerializer.Serialize(new { message = "Bạn chưa đăng nhập hoặc token không hợp lệ." });
                    await context.Response.WriteAsync(payload);
                }
                else if (context.Response.StatusCode == StatusCodes.Status403Forbidden)
                {
                    context.Response.ContentType = "application/json";
                    var payload = JsonSerializer.Serialize(new { message = "Bạn không có quyền truy cập trang này." });
                    await context.Response.WriteAsync(payload);
                }
            });

            app.MapControllers();

            app.Run();
        }
    }
}
