using DocumentService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DocumentService.Infrastructure.Data;

public class DocumentDbContext : DbContext
{
    public DocumentDbContext(DbContextOptions<DocumentDbContext> options) : base(options) { }

    public DbSet<Contract> Contracts => Set<Contract>();
    public DbSet<ContractLineItem> ContractLineItems => Set<ContractLineItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DocumentDbContext).Assembly);
    }
}
