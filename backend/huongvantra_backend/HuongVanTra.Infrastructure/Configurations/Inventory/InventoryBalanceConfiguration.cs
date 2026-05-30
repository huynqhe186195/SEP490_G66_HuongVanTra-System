using HuongVanTra.Core.Entities.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Inventory {
    public class InventoryBalanceConfiguration : IEntityTypeConfiguration<InventoryBalance> {
        public void Configure(EntityTypeBuilder<InventoryBalance> builder) {
            builder.ToTable("inventory_balances");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Quantity).HasColumnType("decimal(18,2)");

            builder.HasIndex(x => new { x.WarehouseId, x.ProductId }).IsUnique();

            builder.HasOne(ib => ib.Warehouse)
                   .WithMany(w => w.Balances)
                   .HasForeignKey(ib => ib.WarehouseId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(ib => ib.Product)
                   .WithMany()
                   .HasForeignKey(ib => ib.ProductId)
                   .OnDelete(DeleteBehavior.Restrict);
        }
    }
}