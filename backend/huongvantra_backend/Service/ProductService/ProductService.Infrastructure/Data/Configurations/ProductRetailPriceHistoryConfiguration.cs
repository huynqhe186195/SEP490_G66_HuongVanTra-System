using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public sealed class ProductRetailPriceHistoryConfiguration : IEntityTypeConfiguration<ProductRetailPriceHistory>
{
    public void Configure(EntityTypeBuilder<ProductRetailPriceHistory> builder)
    {
        builder.ToTable("ProductRetailPriceHistories");
        builder.HasKey(history => history.Id);
        builder.Property(history => history.Id).ValueGeneratedNever();
        builder.Property(history => history.OldRetailPrice).HasColumnType("decimal(18,2)");
        builder.Property(history => history.NewRetailPrice).HasColumnType("decimal(18,2)");
        builder.Property(history => history.ChangedByName).HasMaxLength(255);
        builder.Property(history => history.SourceType).HasMaxLength(50).IsRequired();
        builder.Property(history => history.Note).HasMaxLength(500);
        builder.HasIndex(history => new { history.SkuId, history.ChangedAt });
        builder.HasOne<ProductVariant>()
            .WithMany()
            .HasForeignKey(history => history.SkuId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
