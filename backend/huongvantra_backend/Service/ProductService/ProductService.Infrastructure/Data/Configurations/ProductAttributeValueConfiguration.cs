using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public class ProductAttributeValueConfiguration : IEntityTypeConfiguration<ProductAttributeValue>
{
    public void Configure(EntityTypeBuilder<ProductAttributeValue> builder)
    {
        builder.ToTable("ProductAttributeValues");
        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).ValueGeneratedNever();
        builder.Property(v => v.AttributeName).IsRequired().HasMaxLength(100);
        builder.Property(v => v.Value).IsRequired().HasMaxLength(500);
        builder.Property(v => v.CreatedAt).IsRequired();
        builder.Property(v => v.UpdatedAt).IsRequired(false);
        builder.Property(v => v.IsDeleted).HasDefaultValue(false);

        builder.HasIndex(v => v.ProductId);
        builder.HasIndex(v => v.AttributeNameId);
        builder.HasIndex(v => new { v.ProductId, v.AttributeName, v.Value });

        builder.HasOne(v => v.Product)
            .WithMany(p => p.AttributeValues)
            .HasForeignKey(v => v.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(v => v.AttributeNameRef)
            .WithMany()
            .HasForeignKey(v => v.AttributeNameId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasQueryFilter(v => !v.IsDeleted);
    }
}
