using HuongVanTra.Core.Entities.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Inventory {
    public class InventoryTransactionConfiguration : IEntityTypeConfiguration<InventoryTransaction> {
        public void Configure(EntityTypeBuilder<InventoryTransaction> builder) {
            builder.ToTable("inventory_transactions");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.TxnCode).HasMaxLength(50).IsRequired();
            builder.Property(x => x.TxnType).HasMaxLength(30).IsRequired();
            builder.Property(x => x.RefType).HasMaxLength(50);

            builder.Property(x => x.Quantity).HasColumnType("decimal(18,2)");
            builder.Property(x => x.QuantityBefore).HasColumnType("decimal(18,2)");
            builder.Property(x => x.QuantityAfter).HasColumnType("decimal(18,2)");

            builder.HasOne(t => t.Warehouse).WithMany().HasForeignKey(t => t.WarehouseId).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(t => t.Product).WithMany().HasForeignKey(t => t.ProductId).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(t => t.CreatedBy).WithMany().HasForeignKey(t => t.CreatedById).OnDelete(DeleteBehavior.Restrict);
        }
    }
}