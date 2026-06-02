using HuongVanTra.Core.Entities.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Sales {
    public class OrderStockShortageConfiguration : IEntityTypeConfiguration<OrderStockShortage> {
        public void Configure(EntityTypeBuilder<OrderStockShortage> builder) {
            builder.ToTable("order_stock_shortages");

            builder.HasKey(s => s.Id);

            builder.Property(s => s.Status)
                .IsRequired()
                .HasMaxLength(30);

            builder.Property(s => s.RequiredQuantity)
                .HasColumnType("decimal(18,2)");

            builder.Property(s => s.AvailableQuantity)
                .HasColumnType("decimal(18,2)");

            builder.Property(s => s.ShortageQuantity)
                .HasColumnType("decimal(18,2)");

            builder.Property(s => s.Note)
                .HasMaxLength(500);

            builder.HasOne(s => s.Queue)
                .WithMany()
                .HasForeignKey(s => s.QueueId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(s => s.Order)
                .WithMany()
                .HasForeignKey(s => s.OrderId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
