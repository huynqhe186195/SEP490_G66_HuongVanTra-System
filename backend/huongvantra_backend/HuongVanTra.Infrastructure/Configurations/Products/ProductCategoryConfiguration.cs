using HuongVanTra.Core.Entities.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Products {
    public class ProductCategoryConfiguration : IEntityTypeConfiguration<ProductCategory> {
        public void Configure(EntityTypeBuilder<ProductCategory> builder) {
            builder.ToTable("product_categories");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Name).HasMaxLength(100).IsRequired();

            builder.HasOne(c => c.ParentCategory)
                   .WithMany(c => c.SubCategories)
                   .HasForeignKey(c => c.ParentId)
                   .OnDelete(DeleteBehavior.Restrict);
        }
    }
}