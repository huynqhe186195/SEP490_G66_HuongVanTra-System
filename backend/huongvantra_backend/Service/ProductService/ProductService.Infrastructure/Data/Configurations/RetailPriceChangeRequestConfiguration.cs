using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public sealed class RetailPriceChangeRequestConfiguration : IEntityTypeConfiguration<RetailPriceChangeRequest>
{
    public void Configure(EntityTypeBuilder<RetailPriceChangeRequest> builder)
    {
        builder.ToTable("RetailPriceChangeRequests");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.RequestCode).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().IsRequired().HasMaxLength(50);
        builder.Property(x => x.SkuCode).IsRequired().HasMaxLength(100);
        builder.Property(x => x.ProductName).IsRequired().HasMaxLength(255);
        builder.Property(x => x.VariantName).IsRequired().HasMaxLength(255);
        builder.Property(x => x.CurrentRetailPrice).HasColumnType("decimal(18,2)");
        builder.Property(x => x.RequestedRetailPrice).HasColumnType("decimal(18,2)");
        builder.Property(x => x.AverageCostPriceAtRequest).HasColumnType("decimal(18,2)");
        builder.Property(x => x.AppliedRetailPrice).HasColumnType("decimal(18,2)");
        builder.Property(x => x.Reason).HasMaxLength(1000);
        builder.Property(x => x.CreatedByName).HasMaxLength(255);
        builder.Property(x => x.CreatedByRoleName).HasMaxLength(100);
        builder.Property(x => x.ReviewedByName).HasMaxLength(255);
        builder.Property(x => x.ReviewedByRoleName).HasMaxLength(100);
        builder.Property(x => x.AdminNote).HasColumnType("TEXT");
        builder.Property(x => x.RejectReason).HasMaxLength(1000);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);

        builder.HasIndex(x => x.RequestCode).IsUnique();
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => new { x.SkuId, x.Status });
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
