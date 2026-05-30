using HuongVanTra.Core.Entities.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Sales {
    public class OrderPromotionConfiguration : IEntityTypeConfiguration<OrderPromotion> {
        public void Configure(EntityTypeBuilder<OrderPromotion> builder) {
            builder.ToTable("order_promotions");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.PromoCode).HasMaxLength(50).IsRequired();
            builder.Property(x => x.DiscountType).HasMaxLength(20).IsRequired();
            builder.Property(x => x.DiscountValue).HasColumnType("decimal(18,2)");
        }
    }
}