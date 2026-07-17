using AuditService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AuditService.Infrastructure.Data.Configurations;

public class SystemActivityLogConfiguration : IEntityTypeConfiguration<SystemActivityLog>
{
    public void Configure(EntityTypeBuilder<SystemActivityLog> builder)
    {
        builder.ToTable("SystemActivityLogs");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.EventId).IsRequired();
        builder.Property(x => x.ActorName).HasMaxLength(255);
        builder.Property(x => x.ActorRole).HasMaxLength(100);
        builder.Property(x => x.ServiceName).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Module).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Action).HasMaxLength(255).IsRequired();
        builder.Property(x => x.EntityType).HasMaxLength(100);
        builder.Property(x => x.EntityId).HasMaxLength(100);
        builder.Property(x => x.EntityCode).HasMaxLength(100);
        builder.Property(x => x.Description).HasMaxLength(1000);
        builder.Property(x => x.Result).HasMaxLength(30).IsRequired();
        builder.Property(x => x.Reason).HasMaxLength(2000);
        builder.Property(x => x.BeforeSnapshotJson).HasColumnType("LONGTEXT");
        builder.Property(x => x.AfterSnapshotJson).HasColumnType("LONGTEXT");
        builder.Property(x => x.CorrelationId).HasMaxLength(100).IsRequired();
        builder.Property(x => x.RequestPath).HasMaxLength(500).IsRequired();
        builder.Property(x => x.HttpMethod).HasMaxLength(20).IsRequired();
        builder.Property(x => x.ClientIp).HasMaxLength(100);
        builder.Property(x => x.UserAgent).HasMaxLength(500);

        builder.HasIndex(x => x.EventId).IsUnique();
        builder.HasIndex(x => x.OccurredAtUtc);
        builder.HasIndex(x => x.ActorId);
        builder.HasIndex(x => x.ActorName);
        builder.HasIndex(x => x.ActorRole);
        builder.HasIndex(x => x.ServiceName);
        builder.HasIndex(x => x.Module);
        builder.HasIndex(x => x.Action);
        builder.HasIndex(x => x.EntityCode);
        builder.HasIndex(x => x.Result);
        builder.HasIndex(x => x.CorrelationId);
    }
}
