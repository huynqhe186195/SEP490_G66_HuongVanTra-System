using HuongVanTra.Core.Entities.Stores;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Stores {
    public class StoreConfiguration : IEntityTypeConfiguration<Store> {
        public void Configure(EntityTypeBuilder<Store> builder) {
            builder.ToTable("stores");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Name).HasMaxLength(100).IsRequired();
            builder.Property(x => x.Address).HasMaxLength(255);
            builder.Property(x => x.Phone).HasMaxLength(20);

            builder.HasOne(s => s.Setting)
                   .WithOne(ss => ss.Store)
                   .HasForeignKey<StoreSetting>(ss => ss.StoreId)
                   .OnDelete(DeleteBehavior.Cascade);
        }
    }
}