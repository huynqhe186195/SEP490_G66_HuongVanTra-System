using CustomerService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CustomerService.Infrastructure.Data.Configurations;

public class CustomerTierConfiguration : IEntityTypeConfiguration<CustomerTier>
{
    public void Configure(EntityTypeBuilder<CustomerTier> builder)
    {
        builder.ToTable("CustomerTiers");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedOnAdd();
        builder.Property(t => t.TierName).HasMaxLength(50).IsRequired();
        builder.Property(t => t.MinSpendingThreshold).HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(t => t.DiscountPercent).HasColumnType("decimal(5,2)").IsRequired();
        builder.Property(t => t.ValidityMonths);
        builder.Property(t => t.CreatedAt).IsRequired();
        builder.Property(t => t.UpdatedAt).IsRequired();
        builder.Property(t => t.IsDeleted).HasDefaultValue(false);
    }
}
