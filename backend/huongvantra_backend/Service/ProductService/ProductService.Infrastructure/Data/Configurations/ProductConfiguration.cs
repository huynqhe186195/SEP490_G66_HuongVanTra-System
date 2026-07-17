using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;
using ProductService.Domain.Enums;

namespace ProductService.Infrastructure.Data.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Products");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Name).IsRequired().HasMaxLength(255);
        builder.Property(p => p.Origin).HasMaxLength(100);
        builder.Property(p => p.FlavorProfile).HasMaxLength(255);
        builder.Property(p => p.BrewingGuide).HasColumnType("TEXT");
        builder.Property(p => p.Description).HasColumnType("TEXT");
        builder.Property(p => p.BaseUnit).IsRequired().HasMaxLength(50).HasDefaultValue("unit");
        builder.Property(p => p.InventoryUnit)
            .HasConversion<string>()
            .HasMaxLength(20);
        builder.Property(p => p.WeightValue).HasColumnType("decimal(18,4)");
        builder.Property(p => p.WeightUnit).HasMaxLength(50);
        builder.Property(p => p.IsVariantParent).HasDefaultValue(false);
        builder.Property(p => p.IsActive).HasDefaultValue(true);
        builder.Property(p => p.CreatedAt).IsRequired();
        builder.Property(p => p.UpdatedAt).IsRequired(false);
        builder.Property(p => p.IsDeleted).HasDefaultValue(false);
        builder.Property(p => p.ProductType)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(ProductType.THANH_PHAM);

        builder.HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(p => !p.IsDeleted);
    }
}
