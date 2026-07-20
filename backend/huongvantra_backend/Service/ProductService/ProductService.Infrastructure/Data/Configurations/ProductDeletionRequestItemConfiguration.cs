using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public class ProductDeletionRequestItemConfiguration : IEntityTypeConfiguration<ProductDeletionRequestItem>
{
    public void Configure(EntityTypeBuilder<ProductDeletionRequestItem> builder)
    {
        builder.ToTable("ProductDeletionRequestItems");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ProductSnapshotJson).IsRequired().HasColumnType("LONGTEXT");
        builder.Property(x => x.ProductName).IsRequired().HasMaxLength(255);
        builder.Property(x => x.ProductType).HasMaxLength(50);
        builder.Property(x => x.CategoryName).HasMaxLength(255);
        builder.Property(x => x.Reason).HasColumnType("TEXT");
        builder.Property(x => x.ValidationStatus).IsRequired().HasMaxLength(50);
        builder.Property(x => x.ValidationMessage).HasColumnType("TEXT");
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(x => new { x.RequestId, x.ProductId }).IsUnique();
        builder.HasIndex(x => x.ProductName);
    }
}
