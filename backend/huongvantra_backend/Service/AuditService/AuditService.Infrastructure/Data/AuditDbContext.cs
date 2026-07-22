using AuditService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuditService.Infrastructure.Data;

public class AuditDbContext(DbContextOptions<AuditDbContext> options) : DbContext(options)
{
    public DbSet<SystemActivityLog> SystemActivityLogs => Set<SystemActivityLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AuditDbContext).Assembly);
    }
}
