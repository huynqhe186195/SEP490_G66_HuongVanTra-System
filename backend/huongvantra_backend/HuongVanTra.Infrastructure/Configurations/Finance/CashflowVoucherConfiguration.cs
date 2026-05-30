using HuongVanTra.Core.Entities.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Finance {
    public class CashflowVoucherConfiguration : IEntityTypeConfiguration<CashflowVoucher> {
        public void Configure(EntityTypeBuilder<CashflowVoucher> builder) {
            builder.ToTable("cashflow_vouchers");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.FlowType).HasMaxLength(20).IsRequired();
            builder.Property(x => x.Amount).HasColumnType("decimal(18,2)");

            builder.HasOne(cv => cv.Store).WithMany().HasForeignKey(cv => cv.StoreId).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(cv => cv.CreatedBy).WithMany().HasForeignKey(cv => cv.CreatedById).OnDelete(DeleteBehavior.Restrict);
        }
    }
}