using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public class AttributeNameConfiguration : IEntityTypeConfiguration<AttributeName>
{
    public void Configure(EntityTypeBuilder<AttributeName> builder)
    {
        builder.ToTable("AttributeNames");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedOnAdd();
        builder.Property(a => a.Name).IsRequired().HasMaxLength(200);
        builder.Property(a => a.IsActive).HasDefaultValue(true);
        builder.Property(a => a.IsDeleted).HasDefaultValue(false);
        builder.Property(a => a.CreatedAt).IsRequired();
        builder.Property(a => a.UpdatedAt).IsRequired(false);

        builder.HasQueryFilter(a => !a.IsDeleted);
    }
}
