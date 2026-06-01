using HuongVanTra.Core.Entities.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Sales {
    public class OrderConfiguration : IEntityTypeConfiguration<Order> {
        public void Configure(EntityTypeBuilder<Order> builder) {
            builder.ToTable("orders");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.OrderCode).HasMaxLength(50).IsRequired();
            builder.Property(x => x.SubTotal).HasColumnType("decimal(18,2)");
            builder.Property(x => x.CouponDiscount).HasColumnType("decimal(18,2)");
            builder.Property(x => x.ManualDiscount).HasColumnType("decimal(18,2)");
            builder.Property(x => x.DeductAmount).HasColumnType("decimal(18,2)");
            builder.Property(x => x.TotalAmount).HasColumnType("decimal(18,2)");
            builder.Property(x => x.Notes).HasMaxLength(500);
            builder.HasIndex(x => x.OrderCode);
            builder.HasIndex(x => x.CreatedAt);
            builder.HasIndex(x => x.OrderStatus);
            builder.Property(x => x.PaymentStatus).HasMaxLength(30).IsRequired();
            builder.Property(x => x.StockStatus).HasMaxLength(30).IsRequired();
            builder.Property(x => x.OrderStatus).HasMaxLength(30).IsRequired();

            builder.HasOne(o => o.Store).WithMany().HasForeignKey(o => o.StoreId).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(o => o.Customer).WithMany().HasForeignKey(o => o.CustomerId).OnDelete(DeleteBehavior.SetNull);
            builder.HasOne(o => o.Cashier).WithMany().HasForeignKey(o => o.CashierId).OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(o => o.Promotion)
                   .WithMany(p => p.Orders)
                   .HasForeignKey(o => o.PromotionId)
                   .OnDelete(DeleteBehavior.SetNull);
        }
    }
}