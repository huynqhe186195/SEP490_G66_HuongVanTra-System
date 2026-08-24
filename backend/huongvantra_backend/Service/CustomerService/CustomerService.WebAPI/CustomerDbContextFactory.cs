using CustomerService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CustomerService.WebAPI;

public class CustomerDbContextFactory : IDesignTimeDbContextFactory<CustomerDbContext>
{
    public CustomerDbContext CreateDbContext(string[] args)
    {
        // SEC-01: khong hardcode mat khau DB. Dat CUSTOMER_DB_CONNECTION truoc khi chay dotnet ef.
        var connectionString = Environment.GetEnvironmentVariable("CUSTOMER_DB_CONNECTION")
            ?? throw new InvalidOperationException(
                "Chua dat bien moi truong CUSTOMER_DB_CONNECTION. Vi du (PowerShell): " +
                "$env:CUSTOMER_DB_CONNECTION = 'Server=localhost;Port=3306;Database=hvt_customer_db;User=root;Password=<mat_khau>;'");

        var optionsBuilder = new DbContextOptionsBuilder<CustomerDbContext>();
        optionsBuilder.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)));

        return new CustomerDbContext(optionsBuilder.Options);
    }
}
