using HuongVanTra.Core.Entities.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Inventory {
    public class WarehouseConfiguration : IEntityTypeConfiguration<Warehouse> {
        public void Configure(EntityTypeBuilder<Warehouse> builder) {
            builder.ToTable("warehouses");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Name).HasMaxLength(150).IsRequired();

            builder.HasOne(w => w.Store)
                   .WithMany()
                   .HasForeignKey(w => w.StoreId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(w => w.Manager)
                   .WithMany()
                   .HasForeignKey(w => w.ManagerId)
                   .OnDelete(DeleteBehavior.SetNull);
        }
    }
}