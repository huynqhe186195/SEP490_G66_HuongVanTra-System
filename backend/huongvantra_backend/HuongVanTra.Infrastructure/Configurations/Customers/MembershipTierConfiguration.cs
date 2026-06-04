using HuongVanTra.Core.Entities.Customers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Customers {
    public class MembershipTierConfiguration : IEntityTypeConfiguration<MembershipTier> {
        public void Configure(EntityTypeBuilder<MembershipTier> builder) {
            builder.ToTable("membership_tiers");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.TierCode).HasMaxLength(50).IsRequired();
            builder.Property(x => x.MinTotalSpend).HasColumnType("decimal(18,2)");
            builder.Property(x => x.DiscountPercent).HasColumnType("decimal(5,2)");
            builder.Property(x => x.IsActive).HasDefaultValue(true);
        }
    }
}