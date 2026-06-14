using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public class BrandConfiguration : IEntityTypeConfiguration<Brand>
{
    public void Configure(EntityTypeBuilder<Brand> builder)
    {
        builder.ToTable("Brands");
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).ValueGeneratedOnAdd();
        builder.Property(b => b.Name).IsRequired().HasMaxLength(200);
        builder.Property(b => b.IsActive).HasDefaultValue(true);
        builder.Property(b => b.IsDeleted).HasDefaultValue(false);
        builder.Property(b => b.CreatedAt).IsRequired();
        builder.Property(b => b.UpdatedAt).IsRequired(false);

        builder.HasQueryFilter(b => !b.IsDeleted);
    }
}
