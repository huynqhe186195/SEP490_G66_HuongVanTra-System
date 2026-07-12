using Microsoft.EntityFrameworkCore;
using ProductService.Domain.Entities;
using ProductService.Infrastructure.Data.Configurations;

namespace ProductService.Infrastructure.Data;

public class ProductDbContext(DbContextOptions<ProductDbContext> options) : DbContext(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<AttributeName> AttributeNames => Set<AttributeName>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductUnit> ProductUnits => Set<ProductUnit>();
    public DbSet<PriceBook> PriceBooks => Set<PriceBook>();
    public DbSet<PriceBookEntry> PriceBookEntries => Set<PriceBookEntry>();
    public DbSet<ProductVariantBomLine> ProductVariantBomLines => Set<ProductVariantBomLine>();
    public DbSet<NewProductApprovalRequest> NewProductApprovalRequests => Set<NewProductApprovalRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new CategoryConfiguration());
        modelBuilder.ApplyConfiguration(new BrandConfiguration());
        modelBuilder.ApplyConfiguration(new AttributeNameConfiguration());
        modelBuilder.ApplyConfiguration(new ProductConfiguration());
        modelBuilder.ApplyConfiguration(new ProductImageConfiguration());
        modelBuilder.ApplyConfiguration(new ProductVariantConfiguration());
        modelBuilder.ApplyConfiguration(new ProductUnitConfiguration());
        modelBuilder.ApplyConfiguration(new PriceBookConfiguration());
        modelBuilder.ApplyConfiguration(new PriceBookEntryConfiguration());
        modelBuilder.ApplyConfiguration(new ProductVariantBomLineConfiguration());
        modelBuilder.ApplyConfiguration(new NewProductApprovalRequestConfiguration());
    }
}
