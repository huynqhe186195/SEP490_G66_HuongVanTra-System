using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public class ProductSkuConfiguration : IEntityTypeConfiguration<ProductSku>
{
    public void Configure(EntityTypeBuilder<ProductSku> builder)
    {
        builder.ToTable("ProductSKUs");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.SkuCode).IsRequired().HasMaxLength(50);
        builder.HasIndex(s => s.SkuCode).IsUnique();
        builder.Property(s => s.Barcode).HasMaxLength(100);
        builder.HasIndex(s => s.Barcode).IsUnique();
        builder.Property(s => s.PackagingType).IsRequired().HasMaxLength(50);
        builder.Property(s => s.WeightInGrams).IsRequired();
        builder.Property(s => s.BasePrice).HasColumnType("decimal(18,2)");
        builder.Property(s => s.CostPrice).HasColumnType("decimal(18,2)");
        builder.Property(s => s.RetailPrice).HasColumnType("decimal(18,2)");
        builder.Property(s => s.IsSellable).HasDefaultValue(true);
        builder.Property(s => s.AllowRewardPoints).HasDefaultValue(true);
        builder.Property(s => s.ImageUrl).HasMaxLength(500);
        builder.Property(s => s.IsActive).HasDefaultValue(true);
        builder.Property(s => s.CreatedAt).IsRequired();
        builder.Property(s => s.UpdatedAt).IsRequired(false);
        builder.Property(s => s.IsDeleted).HasDefaultValue(false);

        builder.HasOne(s => s.Product)
            .WithMany(p => p.Skus)
            .HasForeignKey(s => s.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(s => !s.IsDeleted);
    }
}
