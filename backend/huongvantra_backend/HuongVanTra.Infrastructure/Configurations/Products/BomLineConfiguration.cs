using HuongVanTra.Core.Entities.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Products {
    public class BomLineConfiguration : IEntityTypeConfiguration<BomLine> {
        public void Configure(EntityTypeBuilder<BomLine> builder) {
            builder.ToTable("bom_lines");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Quantity).HasColumnType("decimal(18,2)");

            builder.HasOne(bl => bl.Bom)
                   .WithMany(b => b.BomLines)
                   .HasForeignKey(bl => bl.BomId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(bl => bl.Material)
                   .WithMany()
                   .HasForeignKey(bl => bl.MaterialId)
                   .OnDelete(DeleteBehavior.Restrict);
        }
    }
}