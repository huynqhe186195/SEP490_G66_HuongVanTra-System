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
    public DbSet<ProductAttributeValue> ProductAttributeValues => Set<ProductAttributeValue>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductCostPriceHistory> ProductCostPriceHistories => Set<ProductCostPriceHistory>();
    public DbSet<ProductRetailPriceHistory> ProductRetailPriceHistories => Set<ProductRetailPriceHistory>();
    public DbSet<ProductUnit> ProductUnits => Set<ProductUnit>();
    public DbSet<PriceBook> PriceBooks => Set<PriceBook>();
    public DbSet<PriceBookEntry> PriceBookEntries => Set<PriceBookEntry>();
    public DbSet<ProductVariantBomLine> ProductVariantBomLines => Set<ProductVariantBomLine>();
    public DbSet<NewProductApprovalRequest> NewProductApprovalRequests => Set<NewProductApprovalRequest>();
    public DbSet<ProductCreationRequest> ProductCreationRequests => Set<ProductCreationRequest>();
    public DbSet<ProductCreationRequestItem> ProductCreationRequestItems => Set<ProductCreationRequestItem>();
    public DbSet<ProductCreationRequestRevision> ProductCreationRequestRevisions => Set<ProductCreationRequestRevision>();
    public DbSet<ProductDeletionRequest> ProductDeletionRequests => Set<ProductDeletionRequest>();
    public DbSet<ProductDeletionRequestItem> ProductDeletionRequestItems => Set<ProductDeletionRequestItem>();
    public DbSet<ProductDeletionRequestRevision> ProductDeletionRequestRevisions => Set<ProductDeletionRequestRevision>();
    public DbSet<RetailPriceChangeRequest> RetailPriceChangeRequests => Set<RetailPriceChangeRequest>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationRecipient> NotificationRecipients => Set<NotificationRecipient>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new CategoryConfiguration());
        modelBuilder.ApplyConfiguration(new BrandConfiguration());
        modelBuilder.ApplyConfiguration(new AttributeNameConfiguration());
        modelBuilder.ApplyConfiguration(new ProductConfiguration());
        modelBuilder.ApplyConfiguration(new ProductImageConfiguration());
        modelBuilder.ApplyConfiguration(new ProductAttributeValueConfiguration());
        modelBuilder.ApplyConfiguration(new ProductVariantConfiguration());
        modelBuilder.ApplyConfiguration(new ProductCostPriceHistoryConfiguration());
        modelBuilder.ApplyConfiguration(new ProductRetailPriceHistoryConfiguration());
        modelBuilder.ApplyConfiguration(new ProductUnitConfiguration());
        modelBuilder.ApplyConfiguration(new PriceBookConfiguration());
        modelBuilder.ApplyConfiguration(new PriceBookEntryConfiguration());
        modelBuilder.ApplyConfiguration(new ProductVariantBomLineConfiguration());
        modelBuilder.ApplyConfiguration(new NewProductApprovalRequestConfiguration());
        modelBuilder.ApplyConfiguration(new ProductCreationRequestConfiguration());
        modelBuilder.ApplyConfiguration(new ProductCreationRequestItemConfiguration());
        modelBuilder.ApplyConfiguration(new ProductCreationRequestRevisionConfiguration());
        modelBuilder.ApplyConfiguration(new ProductDeletionRequestConfiguration());
        modelBuilder.ApplyConfiguration(new ProductDeletionRequestItemConfiguration());
        modelBuilder.ApplyConfiguration(new ProductDeletionRequestRevisionConfiguration());
        modelBuilder.ApplyConfiguration(new RetailPriceChangeRequestConfiguration());
        modelBuilder.ApplyConfiguration(new NotificationConfiguration());
        modelBuilder.ApplyConfiguration(new NotificationRecipientConfiguration());
    }
}
