using HuongVanTra.Core.Entities.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Products {
    public class ProductConfiguration : IEntityTypeConfiguration<Product> {
        public void Configure(EntityTypeBuilder<Product> builder) {
            builder.ToTable("products");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Sku).HasMaxLength(50).IsRequired();
            builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
            builder.Property(x => x.ProductType).HasMaxLength(30).IsRequired();
            builder.Property(x => x.Price).HasColumnType("decimal(18,2)");
            builder.Property(x => x.MinStockAlert).HasColumnType("decimal(18,2)");

            builder.HasOne(p => p.Category)
                   .WithMany(c => c.Products)
                   .HasForeignKey(p => p.CategoryId)
                   .OnDelete(DeleteBehavior.SetNull);
        }
    }
}