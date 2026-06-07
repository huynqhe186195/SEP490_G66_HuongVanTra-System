using CustomerService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CustomerService.WebAPI;

public class CustomerDbContextFactory : IDesignTimeDbContextFactory<CustomerDbContext>
{
    public CustomerDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<CustomerDbContext>();
        optionsBuilder.UseMySql(
            "Server=localhost;Port=3306;Database=hvt_customer_db;User=root;Password=root;",
            new MySqlServerVersion(new Version(8, 0, 0)));

        return new CustomerDbContext(optionsBuilder.Options);
    }
}
