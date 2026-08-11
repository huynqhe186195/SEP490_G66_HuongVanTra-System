using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OrderService.Domain.Entities;

namespace OrderService.Infrastructure.Data.Configurations;
public sealed class TierUpgradeEmailDeliveryConfiguration : IEntityTypeConfiguration<TierUpgradeEmailDelivery>
{
    public void Configure(EntityTypeBuilder<TierUpgradeEmailDelivery> builder)
    {
        builder.ToTable("TierUpgradeEmailDeliveries"); builder.HasKey(x => x.EventId);
        builder.Property(x => x.TierName).HasMaxLength(100).IsRequired();
        builder.Property(x => x.LastError).HasColumnType("text");
        builder.HasIndex(x => new { x.CustomerId, x.TierName });
    }
}
