using HuongVanTra.Core.Entities.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Inventory {
    public class StockVoucherConfiguration : IEntityTypeConfiguration<StockVoucher> {
        public void Configure(EntityTypeBuilder<StockVoucher> builder) {
            builder.ToTable("stock_vouchers");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.VoucherCode).HasMaxLength(50).IsRequired();
            builder.Property(x => x.VoucherType).HasMaxLength(30).IsRequired();
            builder.Property(x => x.Status).HasMaxLength(30).IsRequired();

            builder.HasOne(v => v.Warehouse)
                   .WithMany()
                   .HasForeignKey(v => v.WarehouseId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(v => v.CreatedBy)
                   .WithMany()
                   .HasForeignKey(v => v.CreatedById)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(v => v.ApprovedBy)
                   .WithMany()
                   .HasForeignKey(v => v.ApprovedById)
                   .OnDelete(DeleteBehavior.Restrict);
        }
    }
}