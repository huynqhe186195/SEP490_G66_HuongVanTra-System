using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public class ProductVariantBomLineConfiguration : IEntityTypeConfiguration<ProductVariantBomLine>
{
    public void Configure(EntityTypeBuilder<ProductVariantBomLine> builder)
    {
        builder.ToTable("ProductVariantBomLines");
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).ValueGeneratedOnAdd();
        builder.Property(b => b.Quantity).HasColumnType("decimal(18,4)").IsRequired();
        builder.Property(b => b.CreatedAt).IsRequired();
        builder.Property(b => b.UpdatedAt).IsRequired(false);
        builder.Property(b => b.IsDeleted).HasDefaultValue(false);

        builder.HasOne(b => b.Variant)
            .WithMany(v => v.BomLines)
            .HasForeignKey(b => b.ProductVariantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(b => b.Material)
            .WithMany()
            .HasForeignKey(b => b.MaterialId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(b => !b.IsDeleted);
    }
}
