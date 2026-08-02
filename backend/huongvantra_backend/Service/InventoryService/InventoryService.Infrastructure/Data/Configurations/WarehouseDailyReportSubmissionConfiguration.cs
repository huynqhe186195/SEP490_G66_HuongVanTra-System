using InventoryService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InventoryService.Infrastructure.Data.Configurations;

public sealed class WarehouseDailyReportSubmissionConfiguration
    : IEntityTypeConfiguration<WarehouseDailyReportSubmission>
{
    public void Configure(EntityTypeBuilder<WarehouseDailyReportSubmission> builder)
    {
        builder.ToTable("WarehouseDailyReportSubmissions");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.BusinessDate).HasColumnType("date").IsRequired();
        builder.Property(x => x.SentAtUtc).IsRequired();
        builder.Property(x => x.SentBy).IsRequired();
        builder.Property(x => x.SentByName).HasMaxLength(255).IsRequired();
        builder.Property(x => x.SentByRoleName).HasMaxLength(100);
        builder.Property(x => x.SnapshotJson).HasColumnType("longtext").IsRequired();
        builder.HasIndex(x => x.SentAtUtc);
        builder.HasIndex(x => x.BusinessDate).IsUnique();
        builder.HasIndex(x => new { x.BusinessDate, x.SentAtUtc });
        builder.HasIndex(x => x.SentBy);
    }
}
