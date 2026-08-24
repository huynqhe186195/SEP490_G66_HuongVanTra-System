using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ProductService.Infrastructure.Data;

public class ProductDbContextFactory : IDesignTimeDbContextFactory<ProductDbContext>
{
    public ProductDbContext CreateDbContext(string[] args)
    {
        // SEC-01: khong hardcode mat khau DB. Dat PRODUCT_DB_CONNECTION truoc khi chay dotnet ef.
        var connectionString = Environment.GetEnvironmentVariable("PRODUCT_DB_CONNECTION")
            ?? throw new InvalidOperationException(
                "Chua dat bien moi truong PRODUCT_DB_CONNECTION. Vi du (PowerShell): " +
                "$env:PRODUCT_DB_CONNECTION = 'Server=localhost;Port=3307;Database=hvt_product_db;User=hvtuser;Password=<mat_khau>;'");

        var optionsBuilder = new DbContextOptionsBuilder<ProductDbContext>();
        optionsBuilder.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)));
        return new ProductDbContext(optionsBuilder.Options);
    }
}
