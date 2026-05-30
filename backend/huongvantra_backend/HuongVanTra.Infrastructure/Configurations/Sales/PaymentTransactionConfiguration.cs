using HuongVanTra.Core.Entities.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Sales {
    public class PaymentTransactionConfiguration : IEntityTypeConfiguration<PaymentTransaction> {
        public void Configure(EntityTypeBuilder<PaymentTransaction> builder) {
            builder.ToTable("payment_transactions");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.PaymentMethod).HasMaxLength(30).IsRequired();
            builder.Property(x => x.Amount).HasColumnType("decimal(18,2)");

            builder.HasOne(pt => pt.Order)
                   .WithMany(o => o.PaymentTransactions)
                   .HasForeignKey(pt => pt.OrderId)
                   .OnDelete(DeleteBehavior.Cascade);
        }
    }
}