using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Infrastructure.Data.Configurations;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.OrderCode).HasMaxLength(50).IsRequired();
        builder.HasIndex(e => e.OrderCode).IsUnique();
        builder.HasIndex(e => e.CustomerId);
        builder.Property(e => e.CustomerSnapshotName).HasMaxLength(100);
        builder.Property(e => e.OrderChannel).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.OrderStatus).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.InventorySyncStatus).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(e => e.TotalAmount).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.DiscountAmount).HasColumnType("decimal(18,2)").IsRequired();
        builder.HasIndex(e => e.PromotionId);
        builder.Property(e => e.PromotionCode).HasMaxLength(50);
        builder.Property(e => e.PromotionDiscountAmount).HasColumnType("decimal(18,2)").HasDefaultValue(0m).IsRequired();
        builder.Property(e => e.FinalAmount).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.ShippingAddress).HasMaxLength(255);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();

        builder.HasMany(e => e.OrderDetails).WithOne(d => d.Order).HasForeignKey(d => d.OrderId);
        builder.HasMany(e => e.Payments).WithOne(p => p.Order).HasForeignKey(p => p.OrderId);
    }
}

public class PromotionConfiguration : IEntityTypeConfiguration<Promotion>
{
    public void Configure(EntityTypeBuilder<Promotion> builder)
    {
        builder.ToTable("Promotions");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.PromoCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.NormalizedPromoCode).HasMaxLength(50).IsRequired();
        builder.HasIndex(e => e.NormalizedPromoCode).IsUnique();
        builder.Property(e => e.DiscountType).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.DiscountValue).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.ScopeType).HasConversion<string>().HasMaxLength(20).HasDefaultValue(PromotionScopeType.ORDER).IsRequired();
        builder.Property(e => e.ValidFromUtc);
        builder.Property(e => e.ValidToUtc);
        builder.Property(e => e.IsActive).IsRequired();
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();
        builder.Property(e => e.IsDeleted).IsRequired();
        builder.HasMany(e => e.Scopes).WithOne(s => s.Promotion).HasForeignKey(s => s.PromotionId);
    }
}

public class PromotionScopeConfiguration : IEntityTypeConfiguration<PromotionScope>
{
    public void Configure(EntityTypeBuilder<PromotionScope> builder)
    {
        builder.ToTable("PromotionScopes");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.ScopeType).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.SkuCode).HasMaxLength(50);
        builder.Property(e => e.SkuSnapshotName).HasMaxLength(255);
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();
        builder.Property(e => e.IsDeleted).IsRequired();
        builder.HasIndex(e => e.PromotionId);
        builder.HasIndex(e => e.SkuId);
    }
}

public class OrderDetailConfiguration : IEntityTypeConfiguration<OrderDetail>
{
    public void Configure(EntityTypeBuilder<OrderDetail> builder)
    {
        builder.ToTable("OrderDetails");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.SkuSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.SkuSnapshotCode).HasMaxLength(50);
        builder.Property(e => e.Quantity).IsRequired();
        builder.Property(e => e.UnitPrice).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.SubTotal).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();
    }
}

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("Payments");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.PaymentMethod).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.PaymentStatus).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.Amount).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.TransactionRef).HasMaxLength(100);
        builder.Property(e => e.CodDebtSettlementJson).HasMaxLength(4000);
        builder.Property(e => e.TransferQrExpiresAtUtc);
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();
    }
}

public class OrderActivityConfiguration : IEntityTypeConfiguration<OrderActivity>
{
    public void Configure(EntityTypeBuilder<OrderActivity> builder)
    {
        builder.ToTable("OrderActivities");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.ActivityType).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(e => e.Description).HasMaxLength(500).IsRequired();
        builder.Property(e => e.ActorName).HasMaxLength(100);
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.HasIndex(e => e.OrderId);
        builder.HasOne(e => e.Order).WithMany().HasForeignKey(e => e.OrderId);
    }
}
