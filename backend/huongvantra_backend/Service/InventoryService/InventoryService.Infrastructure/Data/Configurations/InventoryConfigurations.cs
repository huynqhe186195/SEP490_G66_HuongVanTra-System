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
        builder.Property(e => e.Reason).HasMaxLength(500);
        builder.Property(e => e.ReviewNote).HasMaxLength(500);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(e => e.RequestCode).IsUnique();
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.RequestedBy);
        builder.HasIndex(e => e.RequestedAt);
        builder.HasMany(e => e.Items)
            .WithOne(i => i.Request)
            .HasForeignKey(i => i.RequestId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class StockAdjustmentRequestItemConfiguration : IEntityTypeConfiguration<StockAdjustmentRequestItem>
{
    public void Configure(EntityTypeBuilder<StockAdjustmentRequestItem> builder)
    {
        builder.ToTable("StockAdjustmentRequestItems");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.SkuSnapshotName).HasMaxLength(255).IsRequired();
        builder.HasIndex(e => e.RequestId);
        builder.HasIndex(e => e.SkuId);
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

public class WarehouseBatchConfiguration : IEntityTypeConfiguration<WarehouseBatch>
{
    public void Configure(EntityTypeBuilder<WarehouseBatch> builder)
    {
        builder.ToTable("WarehouseBatches");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.LotCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.Supplier).HasMaxLength(200);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.Status).HasMaxLength(20).IsRequired();
        builder.HasIndex(e => e.LotCode).IsUnique();
        builder.HasIndex(e => e.ExpiresAt);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasMany(e => e.Items)
            .WithOne(i => i.Batch)
            .HasForeignKey(i => i.WarehouseBatchId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class WarehouseBatchItemConfiguration : IEntityTypeConfiguration<WarehouseBatchItem>
{
    public void Configure(EntityTypeBuilder<WarehouseBatchItem> builder)
    {
        builder.ToTable("WarehouseBatchItems");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.ProductSnapshotName).HasMaxLength(255);
        builder.Property(e => e.UnitCost).HasColumnType("decimal(18,2)");
        builder.HasIndex(e => e.SkuId);
        builder.HasIndex(e => e.WarehouseBatchId);
        builder.HasIndex(e => new { e.WarehouseBatchId, e.SkuId }).IsUnique();
    }
}

public class StockExportBatchAllocationConfiguration : IEntityTypeConfiguration<StockExportBatchAllocation>
{
    public void Configure(EntityTypeBuilder<StockExportBatchAllocation> builder)
    {
        builder.ToTable("StockExportBatchAllocations");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.LotCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.HasIndex(e => e.StockExportSlipId);
        builder.HasIndex(e => e.WarehouseBatchId);
        builder.HasIndex(e => e.WarehouseBatchItemId);
        builder.HasOne(e => e.ExportSlip)
            .WithMany(s => s.BatchAllocations)
            .HasForeignKey(e => e.StockExportSlipId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(e => e.Batch)
            .WithMany()
            .HasForeignKey(e => e.WarehouseBatchId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(e => e.BatchItem)
            .WithMany()
            .HasForeignKey(e => e.WarehouseBatchItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ProductionOrderConfiguration : IEntityTypeConfiguration<ProductionOrder>
{
    public void Configure(EntityTypeBuilder<ProductionOrder> builder)
    {
        builder.ToTable("ProductionOrders");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.ProductionCode).HasMaxLength(30).IsRequired();
        builder.Property(e => e.FinishedSkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.FinishedSkuSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(e => e.ProductionCode).IsUnique();
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasMany(e => e.Lines)
            .WithOne(l => l.Order)
            .HasForeignKey(l => l.ProductionOrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProductionOrderLineConfiguration : IEntityTypeConfiguration<ProductionOrderLine>
{
    public void Configure(EntityTypeBuilder<ProductionOrderLine> builder)
    {
        builder.ToTable("ProductionOrderLines");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.MaterialSkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.MaterialSnapshotName).HasMaxLength(255).IsRequired();
        builder.HasIndex(e => e.ProductionOrderId);
        builder.HasIndex(e => e.MaterialSkuId);
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
