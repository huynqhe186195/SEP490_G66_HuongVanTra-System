using HuongVanTra.Core.Entities.Production;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Production {
    public class ProductionOrderConfiguration : IEntityTypeConfiguration<ProductionOrder> {
        public void Configure(EntityTypeBuilder<ProductionOrder> builder) {
            builder.ToTable("production_orders");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.PoCode).HasMaxLength(50).IsRequired();
            builder.Property(x => x.Status).HasMaxLength(30).IsRequired();

            builder.HasOne(po => po.Bom).WithMany().HasForeignKey(po => po.BomId).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(po => po.Warehouse).WithMany().HasForeignKey(po => po.WarehouseId).OnDelete(DeleteBehavior.Restrict);
        }
    }
}