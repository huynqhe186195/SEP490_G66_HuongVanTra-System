using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public class ProductUnitConfiguration : IEntityTypeConfiguration<ProductUnit>
{
    public void Configure(EntityTypeBuilder<ProductUnit> builder)
    {
        builder.ToTable("ProductUnits");
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Id).ValueGeneratedNever();
        builder.Property(u => u.UnitName).IsRequired().HasMaxLength(100);
        builder.Property(u => u.ConversionRate).HasColumnType("decimal(18,4)");
        builder.Property(u => u.Price).HasColumnType("decimal(18,2)");
        builder.Property(u => u.Barcode).HasMaxLength(100);
        builder.Property(u => u.IsDirectSell).HasDefaultValue(true);
        builder.Property(u => u.IsBaseUnit).HasDefaultValue(false);
        builder.Property(u => u.CreatedAt).IsRequired();
        builder.Property(u => u.UpdatedAt).IsRequired(false);
        builder.Property(u => u.IsDeleted).HasDefaultValue(false);

        builder.HasIndex(u => new { u.ProductId, u.UnitName });
        builder.HasIndex(u => u.Barcode).IsUnique();

        builder.HasOne(u => u.Product)
            .WithMany(p => p.Units)
            .HasForeignKey(u => u.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(u => u.Variant)
            .WithMany(v => v.Units)
            .HasForeignKey(u => u.VariantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(u => !u.IsDeleted);
    }
}
