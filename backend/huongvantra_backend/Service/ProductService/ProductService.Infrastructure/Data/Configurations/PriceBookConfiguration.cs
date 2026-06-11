using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public class PriceBookConfiguration : IEntityTypeConfiguration<PriceBook>
{
    public void Configure(EntityTypeBuilder<PriceBook> builder)
    {
        builder.ToTable("PriceBooks");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Code).IsRequired().HasMaxLength(50);
        builder.Property(p => p.Name).IsRequired().HasMaxLength(255);
        builder.Property(p => p.Description).HasColumnType("TEXT");
        builder.Property(p => p.IsActive).HasDefaultValue(true);
        builder.Property(p => p.CreatedAt).IsRequired();
        builder.Property(p => p.UpdatedAt).IsRequired(false);
        builder.Property(p => p.IsDeleted).HasDefaultValue(false);

        builder.HasIndex(p => p.Code).IsUnique();

        builder.HasQueryFilter(p => !p.IsDeleted);
    }
}
