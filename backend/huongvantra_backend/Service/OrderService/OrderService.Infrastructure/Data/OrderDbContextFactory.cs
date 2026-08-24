using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace OrderService.Infrastructure.Data;

public class OrderDbContextFactory : IDesignTimeDbContextFactory<OrderDbContext>
{
    public OrderDbContext CreateDbContext(string[] args)
    {
        // SEC-01: khong hardcode mat khau DB. Dat ORDER_DB_CONNECTION truoc khi chay dotnet ef.
        var connectionString = Environment.GetEnvironmentVariable("ORDER_DB_CONNECTION")
            ?? throw new InvalidOperationException(
                "Chua dat bien moi truong ORDER_DB_CONNECTION. Vi du (PowerShell): " +
                "$env:ORDER_DB_CONNECTION = 'Server=localhost;Port=3306;Database=hvt_order_db;Uid=root;Pwd=<mat_khau>;'");

        var optionsBuilder = new DbContextOptionsBuilder<OrderDbContext>();
        optionsBuilder.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)));
        return new OrderDbContext(optionsBuilder.Options);
    }
}
