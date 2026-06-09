using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProductService.Domain.Entities;

namespace ProductService.Infrastructure.Data.Configurations;

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedOnAdd();
        builder.Property(c => c.Name).IsRequired().HasMaxLength(100);
        builder.Property(c => c.Description).HasMaxLength(500);
        builder.Property(c => c.ParentId).IsRequired(false);
        builder.Property(c => c.CreatedAt).IsRequired();
        builder.Property(c => c.UpdatedAt).IsRequired(false);
        builder.Property(c => c.IsActive).HasDefaultValue(true);
        builder.Property(c => c.IsDeleted).HasDefaultValue(false);

        builder.HasOne(c => c.Parent)
            .WithMany(c => c.Children)
            .HasForeignKey(c => c.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(c => !c.IsDeleted);
    }
}
