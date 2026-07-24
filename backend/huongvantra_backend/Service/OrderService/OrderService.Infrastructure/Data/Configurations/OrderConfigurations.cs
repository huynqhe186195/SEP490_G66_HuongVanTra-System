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
        builder.Property(e => e.OrderKind).HasConversion<string>().HasMaxLength(20).HasDefaultValue(OrderKind.Sale).IsRequired();
        builder.HasIndex(e => e.OrderKind);
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
        builder.Property(e => e.IdempotencyKey).HasMaxLength(100);
        builder.HasIndex(e => e.IdempotencyKey).IsUnique().HasFilter("`IdempotencyKey` IS NOT NULL");
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
        builder.Property(e => e.MaxDiscountAmount).HasColumnType("decimal(18,2)");
        builder.Property(e => e.MinimumOrderAmount).HasColumnType("decimal(18,2)").HasDefaultValue(0m).IsRequired();
        builder.Property(e => e.UsageLimitTotal);
        builder.Property(e => e.UsageLimitPerCustomer);
        builder.Property(e => e.ScopeType).HasConversion<string>().HasMaxLength(20).HasDefaultValue(PromotionScopeType.ORDER).IsRequired();
        builder.Property(e => e.ValidFromUtc);
        builder.Property(e => e.ValidToUtc);
        builder.Property(e => e.IsActive).IsRequired();
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();
        builder.Property(e => e.IsDeleted).IsRequired();
        builder.HasMany(e => e.Scopes).WithOne(s => s.Promotion).HasForeignKey(s => s.PromotionId);
        builder.HasMany(e => e.CustomerTierScopes).WithOne(s => s.Promotion).HasForeignKey(s => s.PromotionId);
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
        builder.Property(e => e.CategorySnapshotName).HasMaxLength(255);
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();
        builder.Property(e => e.IsDeleted).IsRequired();
        builder.HasIndex(e => e.PromotionId);
        builder.HasIndex(e => e.SkuId);
        builder.HasIndex(e => e.CategoryId);
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
        builder.Property(e => e.ReturnedQuantity).HasDefaultValue(0).IsRequired();
        builder.Property(e => e.UnitPrice).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.SubTotal).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.IsGift).HasDefaultValue(false).IsRequired();
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();
    }
}

public class PromotionCustomerTierScopeConfiguration : IEntityTypeConfiguration<PromotionCustomerTierScope>
{
    public void Configure(EntityTypeBuilder<PromotionCustomerTierScope> builder)
    {
        builder.ToTable("PromotionCustomerTierScopes");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.TierId).IsRequired();
        builder.Property(e => e.TierSnapshotName).HasMaxLength(255);
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();
        builder.Property(e => e.IsDeleted).IsRequired();
        builder.HasIndex(e => e.PromotionId);
        builder.HasIndex(e => e.TierId);
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

public class ReturnOrderConfiguration : IEntityTypeConfiguration<ReturnOrder>
{
    public void Configure(EntityTypeBuilder<ReturnOrder> builder)
    {
        builder.ToTable("ReturnOrders");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.ReturnCode).HasMaxLength(50).IsRequired();
        builder.HasIndex(e => e.ReturnCode).IsUnique();
        builder.Property(e => e.SourceOrderCode).HasMaxLength(50).IsRequired();
        builder.HasIndex(e => e.SourceOrderId);
        builder.Property(e => e.CustomerSnapshotName).HasMaxLength(100);
        builder.Property(e => e.ReturnAmount).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.ExchangeAmount).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.NetCustomerPays).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.RefundAmount).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.CustomerPaidAmount).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.RefundMethod).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();

        builder.HasOne(e => e.SourceOrder).WithMany(o => o.ReturnOrders).HasForeignKey(e => e.SourceOrderId);
        builder.HasMany(e => e.Details).WithOne(d => d.ReturnOrder).HasForeignKey(d => d.ReturnOrderId);
    }
}

public class ReturnOrderDetailConfiguration : IEntityTypeConfiguration<ReturnOrderDetail>
{
    public void Configure(EntityTypeBuilder<ReturnOrderDetail> builder)
    {
        builder.ToTable("ReturnOrderDetails");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.SkuSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.SkuSnapshotCode).HasMaxLength(50);
        builder.Property(e => e.ReturnQuantity).IsRequired();
        builder.Property(e => e.UnitPrice).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.SubTotal).HasColumnType("decimal(18,2)").IsRequired();
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

public class CustomBundleConfiguration : IEntityTypeConfiguration<CustomBundle>
{
    public void Configure(EntityTypeBuilder<CustomBundle> builder)
    {
        builder.ToTable("CustomBundles");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Label).HasMaxLength(200);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.TotalPrice).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.PackingStatus).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.PackedAt);
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();
        builder.HasIndex(e => e.OrderId);
        builder.HasIndex(e => e.PackingStatus);
        builder.HasOne(e => e.Order).WithMany(o => o.CustomBundles).HasForeignKey(e => e.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(e => e.Ingredients).WithOne(i => i.Bundle).HasForeignKey(i => i.CustomBundleId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CustomBundleIngredientConfiguration : IEntityTypeConfiguration<CustomBundleIngredient>
{
    public void Configure(EntityTypeBuilder<CustomBundleIngredient> builder)
    {
        builder.ToTable("CustomBundleIngredients");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.MaterialSkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.MaterialSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.Quantity).IsRequired();
        builder.Property(e => e.UnitPrice).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.SubTotal).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();
        builder.HasIndex(e => e.CustomBundleId);
    }
}

public class PosCashSessionConfiguration : IEntityTypeConfiguration<PosCashSession>
{
    public void Configure(EntityTypeBuilder<PosCashSession> builder)
    {
        builder.ToTable("PosCashSessions");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.OpeningCash).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(e => e.CashSalesTotal).HasColumnType("decimal(18,2)").HasDefaultValue(0m).IsRequired();
        builder.Property(e => e.CashRefundTotal).HasColumnType("decimal(18,2)").HasDefaultValue(0m).IsRequired();
        builder.Property(e => e.OrderCount).HasDefaultValue(0).IsRequired();
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.OpenedByName).HasMaxLength(100).IsRequired();
        builder.Property(e => e.OpenedByRole).HasMaxLength(100);
        builder.Property(e => e.ShiftLabel).HasMaxLength(200);
        builder.Property(e => e.OpenedAt).IsRequired();
        builder.Property(e => e.CountedCash).HasColumnType("decimal(18,2)");
        builder.Property(e => e.ExpectedCash).HasColumnType("decimal(18,2)");
        builder.Property(e => e.Variance).HasColumnType("decimal(18,2)");
        builder.Property(e => e.VarianceNote).HasMaxLength(500);
        builder.Property(e => e.ClosedByName).HasMaxLength(100);
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.OpenedByUserId);
    }
}
