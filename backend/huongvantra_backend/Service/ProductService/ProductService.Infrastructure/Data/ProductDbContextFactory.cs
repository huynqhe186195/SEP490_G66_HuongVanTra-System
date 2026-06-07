using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ProductService.Infrastructure.Data;

public class ProductDbContextFactory : IDesignTimeDbContextFactory<ProductDbContext>
{
    public ProductDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<ProductDbContext>();
        optionsBuilder.UseMySql(
            "Server=localhost;Port=3307;Database=hvt_product_db;User=hvtuser;Password=hvtpass123;",
            new MySqlServerVersion(new Version(8, 0, 0)));
        return new ProductDbContext(optionsBuilder.Options);
    }
}
