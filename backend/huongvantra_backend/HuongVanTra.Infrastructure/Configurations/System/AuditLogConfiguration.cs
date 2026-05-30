using HuongVanTra.Core.Entities.System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HuongVanTra.Infrastructure.Configurations.System {
    public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog> {
        public void Configure(EntityTypeBuilder<AuditLog> builder) {
            builder.ToTable("audit_logs");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Action).HasMaxLength(50).IsRequired();
            builder.Property(x => x.EntityType).HasMaxLength(100).IsRequired();
            builder.Property(x => x.Status).HasMaxLength(30).IsRequired();

            builder.Property(x => x.OldValues).HasColumnType("json");
            builder.Property(x => x.NewValues).HasColumnType("json");
        }
    }
}