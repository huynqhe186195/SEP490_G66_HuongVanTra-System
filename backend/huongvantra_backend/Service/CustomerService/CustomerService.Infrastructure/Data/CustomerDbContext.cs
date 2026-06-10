using CustomerService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CustomerService.Infrastructure.Data;

public class CustomerDbContext : DbContext
{
    public CustomerDbContext(DbContextOptions<CustomerDbContext> options) : base(options) { }

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerTier> CustomerTiers => Set<CustomerTier>();
    public DbSet<CustomerAddress> CustomerAddresses => Set<CustomerAddress>();
    public DbSet<ProcessedIntegrationEvent> ProcessedIntegrationEvents => Set<ProcessedIntegrationEvent>();
    public DbSet<CustomerDebtTransaction> CustomerDebtTransactions => Set<CustomerDebtTransaction>();
    public DbSet<CustomerDebtAllocation> CustomerDebtAllocations => Set<CustomerDebtAllocation>();
    public DbSet<CustomerActivity> CustomerActivities => Set<CustomerActivity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CustomerDbContext).Assembly);
    }
}
