using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace InventoryService.Infrastructure.Data.Configurations;

public class SkuStockConfiguration : IEntityTypeConfiguration<SkuStock>
{
    public void Configure(EntityTypeBuilder<SkuStock> builder)
    {
        builder.ToTable("SkuStocks");
        builder.HasKey(e => e.SkuId);
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.HasIndex(e => e.SkuCode);
    }
}

public class StockDeductQueueConfiguration : IEntityTypeConfiguration<StockDeductQueue>
{
    public void Configure(EntityTypeBuilder<StockDeductQueue> builder)
    {
        builder.ToTable("StockDeductQueues");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.OrderCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.OrderPaymentStatus).HasMaxLength(30).IsRequired();
        builder.Property(e => e.OrderStockStatus).HasMaxLength(30).IsRequired();
        builder.Property(e => e.QueueStatus).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.TotalAmount).HasColumnType("decimal(18,2)");
        builder.HasIndex(e => e.OrderId).IsUnique();
        builder.HasMany(e => e.Items).WithOne(i => i.Queue).HasForeignKey(i => i.QueueId);
    }
}

public class StockDeductQueueItemConfiguration : IEntityTypeConfiguration<StockDeductQueueItem>
{
    public void Configure(EntityTypeBuilder<StockDeductQueueItem> builder)
    {
        builder.ToTable("StockDeductQueueItems");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.SkuSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.SkuSnapshotCode).HasMaxLength(50);
    }
}

public class StockAdjustmentRequestConfiguration : IEntityTypeConfiguration<StockAdjustmentRequest>
{
    public void Configure(EntityTypeBuilder<StockAdjustmentRequest> builder)
    {
        builder.ToTable("StockAdjustmentRequests");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.RequestCode).HasMaxLength(30).IsRequired();
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.SkuSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.Reason).HasMaxLength(500);
        builder.Property(e => e.ReviewNote).HasMaxLength(500);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(e => e.RequestCode).IsUnique();
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.RequestedBy);
        builder.HasIndex(e => e.RequestedAt);
        builder.HasIndex(e => e.ExportSlipId);
        builder.HasOne(e => e.ExportSlip)
            .WithMany()
            .HasForeignKey(e => e.ExportSlipId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class StockExportSlipConfiguration : IEntityTypeConfiguration<StockExportSlip>
{
    public void Configure(EntityTypeBuilder<StockExportSlip> builder)
    {
        builder.ToTable("StockExportSlips");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.ExportCode).HasMaxLength(30).IsRequired();
        builder.Property(e => e.ExportType).HasMaxLength(30).IsRequired();
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.SkuSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.HasIndex(e => e.ExportCode).IsUnique();
        builder.HasIndex(e => e.StockAdjustmentRequestId);
        builder.HasIndex(e => e.CreatedAt);
    }
}

public class ProcessedIntegrationEventConfiguration : IEntityTypeConfiguration<ProcessedIntegrationEvent>
{
    public void Configure(EntityTypeBuilder<ProcessedIntegrationEvent> builder)
    {
        builder.ToTable("ProcessedIntegrationEvents");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.EventType).HasMaxLength(100).IsRequired();
        builder.HasIndex(e => new { e.EventType, e.CorrelationId }).IsUnique();
    }
}
