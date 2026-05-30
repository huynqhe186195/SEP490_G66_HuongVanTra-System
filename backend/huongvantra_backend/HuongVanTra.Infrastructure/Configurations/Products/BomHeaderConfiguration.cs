using HuongVanTra.Core.Entities.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Products {
    public class BomHeaderConfiguration : IEntityTypeConfiguration<BomHeader> {
        public void Configure(EntityTypeBuilder<BomHeader> builder) {
            builder.ToTable("bom_headers");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.QuantityOutput).HasColumnType("decimal(18,2)");

            builder.HasOne(b => b.FinishedGood)
                   .WithOne(p => p.BomHeader)
                   .HasForeignKey<BomHeader>(b => b.FinishedGoodId)
                   .OnDelete(DeleteBehavior.Cascade);
        }
    }
}