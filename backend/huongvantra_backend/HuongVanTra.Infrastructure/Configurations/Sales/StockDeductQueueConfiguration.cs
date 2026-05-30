using HuongVanTra.Core.Entities.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Sales {
    public class StockDeductQueueConfiguration : IEntityTypeConfiguration<StockDeductQueue> {
        public void Configure(EntityTypeBuilder<StockDeductQueue> builder) {
            builder.ToTable("stock_deduct_queue");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Status).HasMaxLength(30).IsRequired();
            builder.Property(x => x.BomSnapshot).HasColumnType("json").IsRequired();

            builder.HasOne(q => q.Order)
                   .WithOne(o => o.StockDeductQueue)
                   .HasForeignKey<StockDeductQueue>(q => q.OrderId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(q => q.ConfirmedBy)
                   .WithMany()
                   .HasForeignKey(q => q.ConfirmedById)
                   .OnDelete(DeleteBehavior.SetNull);
        }
    }
}