using HuongVanTra.Core.Entities.Stores;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.Stores {
    public class StoreSettingConfiguration : IEntityTypeConfiguration<StoreSetting> {
        public void Configure(EntityTypeBuilder<StoreSetting> builder) {
            builder.ToTable("store_settings");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.OpeningHours).HasMaxLength(50);
            builder.Property(x => x.TaxCode).HasMaxLength(50);
            builder.Property(x => x.WifiPassword).HasMaxLength(50);
        }
    }
}