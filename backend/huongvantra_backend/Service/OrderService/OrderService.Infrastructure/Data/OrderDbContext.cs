using Microsoft.EntityFrameworkCore;
using OrderService.Domain.Entities;

namespace OrderService.Infrastructure.Data;

public class OrderDbContext(DbContextOptions<OrderDbContext> options) : DbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderDetail> OrderDetails => Set<OrderDetail>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<OrderActivity> OrderActivities => Set<OrderActivity>();
    public DbSet<Promotion> Promotions => Set<Promotion>();
    public DbSet<PromotionScope> PromotionScopes => Set<PromotionScope>();
    public DbSet<PromotionCustomerTierScope> PromotionCustomerTierScopes => Set<PromotionCustomerTierScope>();
    public DbSet<ReturnOrder> ReturnOrders => Set<ReturnOrder>();
    public DbSet<ReturnOrderDetail> ReturnOrderDetails => Set<ReturnOrderDetail>();
    public DbSet<CustomBundle> CustomBundles => Set<CustomBundle>();
    public DbSet<CustomBundleIngredient> CustomBundleIngredients => Set<CustomBundleIngredient>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<OrderReceiptPrintLog> OrderReceiptPrintLogs => Set<OrderReceiptPrintLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(OrderDbContext).Assembly);

        modelBuilder.Entity<Order>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<OrderDetail>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Payment>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Promotion>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<PromotionScope>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<PromotionCustomerTierScope>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<ReturnOrder>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<ReturnOrderDetail>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<CustomBundle>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<CustomBundleIngredient>().HasQueryFilter(e => !e.IsDeleted);
    }
}
