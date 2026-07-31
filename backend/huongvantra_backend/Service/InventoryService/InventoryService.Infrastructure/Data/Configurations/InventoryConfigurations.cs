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
        builder.Property(e => e.LowStockThreshold).HasDefaultValue(0);
        builder.Property(e => e.WarehouseLowStockThreshold).HasDefaultValue(0);
        builder.Property(e => e.ShelfLowStockThreshold).HasDefaultValue(0);
        // POS-04: giữ chỗ tồn Kệ Hàng cho đơn COD chờ xác nhận.
        builder.Property(e => e.ReservedQuantity).HasDefaultValue(0);
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
        builder.Property(e => e.CustomerSnapshotName).HasMaxLength(255);
        builder.Property(e => e.QueueStatus).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.ConfirmedByName).HasMaxLength(255);
        builder.Property(e => e.ConfirmedByRoleName).HasMaxLength(100);
        builder.Property(e => e.CancelledByName).HasMaxLength(255);
        builder.Property(e => e.CancelledByRoleName).HasMaxLength(100);
        builder.Property(e => e.CancelReason).HasMaxLength(500);
        builder.Property(e => e.LastShortageReason).HasMaxLength(500);
        builder.Property(e => e.TotalAmount).HasColumnType("decimal(18,2)");
        builder.HasIndex(e => e.OrderId).IsUnique();
        builder.HasIndex(e => e.QueueStatus);
        builder.HasIndex(e => e.ConfirmedBy);
        builder.HasIndex(e => e.CancelledBy);
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
        builder.Property(e => e.MaterialRequirementSnapshotJson).HasColumnType("LONGTEXT");
        builder.Property(e => e.StockHandlingMode).HasMaxLength(50);
        // POS-04 (truy vết giữ chỗ): trạng thái + mốc thời gian giữ chỗ ở cấp dòng SKU.
        builder.Property(e => e.ReservationStatus)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(StockReservationStatus.None)
            .IsRequired();
        builder.Property(e => e.ReservedQuantity).HasDefaultValue(0);
        builder.HasIndex(e => e.SkuId);
        builder.HasIndex(e => new { e.SkuId, e.ReservationStatus });
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
        builder.Property(e => e.RequestedByName).HasMaxLength(255);
        builder.Property(e => e.RequestedByRoleName).HasMaxLength(100);
        builder.Property(e => e.ReviewedByName).HasMaxLength(255);
        builder.Property(e => e.ReviewedByRoleName).HasMaxLength(100);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(e => e.RequestCode).IsUnique();
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.RequestedBy);
        builder.HasIndex(e => e.RequestedAt);
        builder.HasIndex(e => e.RequestedByRoleName);
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
        builder.Property(e => e.ApprovedQuantity).HasDefaultValue(0);
        builder.Property(e => e.FulfilledQuantity).HasDefaultValue(0);
        builder.Property(e => e.RejectedQuantity).HasDefaultValue(0);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.ReviewNote).HasMaxLength(500);
        builder.Property(e => e.RejectionReason).HasMaxLength(500);
        builder.Property(e => e.ClosedReason).HasMaxLength(500);
        // Số lượng còn lại luôn suy ra được từ Requested - Fulfilled - Rejected nên không lưu DB.
        builder.Ignore(e => e.RemainingQuantity);
        builder.HasIndex(e => e.RequestId);
        builder.HasIndex(e => e.SkuId);
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.ExportSlipId);
        builder.HasOne(e => e.ExportSlip)
            .WithMany()
            .HasForeignKey(e => e.ExportSlipId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class StockTransferConfiguration : IEntityTypeConfiguration<StockTransfer>
{
    public void Configure(EntityTypeBuilder<StockTransfer> builder)
    {
        builder.ToTable("StockTransfers");
        builder.HasKey(transfer => transfer.Id);
        builder.Property(transfer => transfer.TransferCode).HasMaxLength(30).IsRequired();
        builder.Property(transfer => transfer.SourceLocation).HasMaxLength(20).IsRequired();
        builder.Property(transfer => transfer.DestinationLocation).HasMaxLength(20).IsRequired();
        builder.Property(transfer => transfer.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(transfer => transfer.Note).HasMaxLength(500);
        builder.Property(transfer => transfer.CreatedByName).HasMaxLength(255);
        builder.Property(transfer => transfer.CreatedByRoleName).HasMaxLength(100);
        builder.Property(transfer => transfer.CompletedByName).HasMaxLength(255);
        builder.Property(transfer => transfer.CompletedByRoleName).HasMaxLength(100);
        builder.Property(transfer => transfer.CancellationReason).HasMaxLength(500);
        builder.HasIndex(transfer => transfer.TransferCode).IsUnique();
        builder.HasIndex(transfer => transfer.Status);
        builder.HasIndex(transfer => transfer.CreatedBy);
        builder.HasIndex(transfer => transfer.CreatedAt);
        builder.HasIndex(transfer => transfer.CompletedAt);
        builder.HasIndex(transfer => transfer.ExportSlipId);
        builder.HasIndex(transfer => transfer.ImportSlipId);
        builder.HasIndex(transfer => transfer.SourceRequestId);
        // Một Yêu cầu bổ sung Kệ Hàng có thể sinh ra nhiều Phiếu điều chuyển: không đặt unique index.
        builder.HasOne(transfer => transfer.SourceRequest)
            .WithMany()
            .HasForeignKey(transfer => transfer.SourceRequestId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(transfer => transfer.ExportSlip)
            .WithMany()
            .HasForeignKey(transfer => transfer.ExportSlipId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(transfer => transfer.ImportSlip)
            .WithMany()
            .HasForeignKey(transfer => transfer.ImportSlipId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasMany(transfer => transfer.Lines)
            .WithOne(line => line.StockTransfer)
            .HasForeignKey(line => line.StockTransferId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(transfer => transfer.BatchAllocations)
            .WithOne(allocation => allocation.StockTransfer)
            .HasForeignKey(allocation => allocation.StockTransferId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class StockTransferLineConfiguration : IEntityTypeConfiguration<StockTransferLine>
{
    public void Configure(EntityTypeBuilder<StockTransferLine> builder)
    {
        builder.ToTable("StockTransferLines");
        builder.HasKey(line => line.Id);
        builder.Property(line => line.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(line => line.SkuNameSnapshot).HasMaxLength(255).IsRequired();
        builder.Property(line => line.UnitNameSnapshot).HasMaxLength(30);
        builder.HasIndex(line => line.StockTransferId);
        builder.HasIndex(line => line.SkuId);
        builder.HasIndex(line => new { line.StockTransferId, line.SkuId }).IsUnique();
        builder.HasIndex(line => line.SourceRequestLineId);
        builder.HasOne(line => line.SourceRequestLine)
            .WithMany()
            .HasForeignKey(line => line.SourceRequestLineId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class StockTransferBatchAllocationConfiguration : IEntityTypeConfiguration<StockTransferBatchAllocation>
{
    public void Configure(EntityTypeBuilder<StockTransferBatchAllocation> builder)
    {
        builder.ToTable("StockTransferBatchAllocations");
        builder.HasKey(allocation => allocation.Id);
        builder.HasIndex(allocation => allocation.StockTransferId);
        builder.HasIndex(allocation => allocation.StockTransferLineId);
        builder.HasIndex(allocation => allocation.SourceWarehouseBatchId);
        builder.HasIndex(allocation => allocation.SourceWarehouseBatchItemId);
        builder.HasIndex(allocation => allocation.DestinationWarehouseBatchId);
        builder.HasIndex(allocation => allocation.DestinationWarehouseBatchItemId);
        builder.HasOne(allocation => allocation.StockTransferLine)
            .WithMany(line => line.BatchAllocations)
            .HasForeignKey(allocation => allocation.StockTransferLineId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(allocation => allocation.SourceWarehouseBatch)
            .WithMany()
            .HasForeignKey(allocation => allocation.SourceWarehouseBatchId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(allocation => allocation.SourceWarehouseBatchItem)
            .WithMany()
            .HasForeignKey(allocation => allocation.SourceWarehouseBatchItemId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(allocation => allocation.DestinationWarehouseBatch)
            .WithMany()
            .HasForeignKey(allocation => allocation.DestinationWarehouseBatchId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(allocation => allocation.DestinationWarehouseBatchItem)
            .WithMany()
            .HasForeignKey(allocation => allocation.DestinationWarehouseBatchItemId)
            .OnDelete(DeleteBehavior.Restrict);
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
        builder.Property(e => e.ProductionCode).HasMaxLength(30);
        builder.Property(e => e.ReferenceType).HasMaxLength(50);
        builder.Property(e => e.ReferenceCode).HasMaxLength(50);
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.SkuSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.CreatedByName).HasMaxLength(255);
        builder.Property(e => e.CreatedByRoleName).HasMaxLength(100);
        builder.HasIndex(e => e.ExportCode).IsUnique();
        builder.HasIndex(e => e.StockAdjustmentRequestId);
        builder.HasIndex(e => e.ProductionOrderId);
        builder.HasIndex(e => e.ProductionCode);
        builder.HasIndex(e => e.ReferenceId);
        builder.HasIndex(e => e.ReferenceCode);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasOne<ProductionOrder>()
            .WithMany()
            .HasForeignKey(e => e.ProductionOrderId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasMany(e => e.Lines)
            .WithOne(l => l.ExportSlip)
            .HasForeignKey(l => l.StockExportSlipId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class StockExportSlipLineConfiguration : IEntityTypeConfiguration<StockExportSlipLine>
{
    public void Configure(EntityTypeBuilder<StockExportSlipLine> builder)
    {
        builder.ToTable("StockExportSlipLines");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.ProductSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.HasIndex(e => e.StockExportSlipId);
        builder.HasIndex(e => e.SkuId);
        builder.HasMany(e => e.BatchAllocations)
            .WithOne(a => a.ExportSlipLine)
            .HasForeignKey(a => a.StockExportSlipLineId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class StockImportSlipConfiguration : IEntityTypeConfiguration<StockImportSlip>
{
    public void Configure(EntityTypeBuilder<StockImportSlip> builder)
    {
        builder.ToTable("StockImportSlips");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.ImportCode).HasMaxLength(30).IsRequired();
        builder.Property(e => e.ImportType).HasMaxLength(50).IsRequired();
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.ProductSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.WarehouseBatchLotCode).HasMaxLength(50);
        builder.Property(e => e.ProductionCode).HasMaxLength(30);
        builder.Property(e => e.SupplierReceiptCode).HasMaxLength(30);
        builder.Property(e => e.ReferenceType).HasMaxLength(50);
        builder.Property(e => e.ReferenceCode).HasMaxLength(50);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.CreatedByName).HasMaxLength(255);
        builder.Property(e => e.CreatedByRoleName).HasMaxLength(100);
        builder.HasIndex(e => e.ImportCode).IsUnique();
        builder.HasIndex(e => e.ImportType);
        builder.HasIndex(e => e.SkuId);
        builder.HasIndex(e => e.WarehouseBatchId);
        builder.HasIndex(e => e.ProductionOrderId);
        builder.HasIndex(e => e.ProductionCode);
        builder.HasIndex(e => e.SupplierReceiptId);
        builder.HasIndex(e => e.SupplierReceiptCode);
        builder.HasIndex(e => e.ReferenceId);
        builder.HasIndex(e => e.ReferenceCode);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasOne<WarehouseBatch>()
            .WithMany()
            .HasForeignKey(e => e.WarehouseBatchId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<ProductionOrder>()
            .WithMany()
            .HasForeignKey(e => e.ProductionOrderId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<SupplierReceipt>()
            .WithMany()
            .HasForeignKey(e => e.SupplierReceiptId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasMany(e => e.Lines)
            .WithOne(l => l.ImportSlip)
            .HasForeignKey(l => l.StockImportSlipId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class StockImportSlipLineConfiguration : IEntityTypeConfiguration<StockImportSlipLine>
{
    public void Configure(EntityTypeBuilder<StockImportSlipLine> builder)
    {
        builder.ToTable("StockImportSlipLines");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.ProductSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.WarehouseBatchLotCode).HasMaxLength(50);
        builder.Property(e => e.DestinationLocation).HasMaxLength(20);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.HasIndex(e => e.StockImportSlipId);
        builder.HasIndex(e => e.SkuId);
        builder.HasIndex(e => e.WarehouseBatchId);
        builder.HasIndex(e => e.ProductionOrderOutputLineId);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasOne(e => e.WarehouseBatch)
            .WithMany()
            .HasForeignKey(e => e.WarehouseBatchId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(e => e.ProductionOrderOutputLine)
            .WithMany()
            .HasForeignKey(e => e.ProductionOrderOutputLineId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class WarehouseBatchConfiguration : IEntityTypeConfiguration<WarehouseBatch>
{
    public void Configure(EntityTypeBuilder<WarehouseBatch> builder)
    {
        builder.ToTable("WarehouseBatches");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.BatchCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.LotCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.Supplier).HasMaxLength(200);
        builder.Property(e => e.NormalizedSupplierLotCode).HasMaxLength(50);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.SourceType).HasMaxLength(50);
        builder.Property(e => e.SourceReferenceCode).HasMaxLength(50);
        builder.Property(e => e.Location).HasMaxLength(20).HasDefaultValue("Warehouse").IsRequired();
        builder.Property(e => e.Status).HasMaxLength(20).IsRequired();
        builder.HasIndex(e => e.BatchCode).IsUnique();
        builder.HasIndex(e => e.LotCode);
        // Lô NCC là duy nhất theo SupplierId + SkuId + mã lô đã chuẩn hóa.
        // Lô legacy/nội bộ để cả ba cột null nên MySQL bỏ qua trong unique index.
        builder.HasIndex(e => new { e.SupplierId, e.SkuId, e.NormalizedSupplierLotCode })
            .IsUnique()
            .HasDatabaseName("IX_WarehouseBatches_SupplierLotIdentity");
        builder.HasIndex(e => e.Location);
        builder.HasIndex(e => e.ParentBatchId);
        builder.HasIndex(e => e.SourceBatchId);
        builder.HasIndex(e => e.SourceReferenceId);
        builder.HasIndex(e => e.SourceReferenceCode);
        builder.HasIndex(e => e.ExpiresAt);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasOne(e => e.ParentBatch)
            .WithMany()
            .HasForeignKey(e => e.ParentBatchId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(e => e.SourceBatch)
            .WithMany()
            .HasForeignKey(e => e.SourceBatchId)
            .OnDelete(DeleteBehavior.SetNull);
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
        builder.HasIndex(e => e.StockExportSlipLineId);
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

public class InventoryLedgerEntryConfiguration : IEntityTypeConfiguration<InventoryLedgerEntry>
{
    public void Configure(EntityTypeBuilder<InventoryLedgerEntry> builder)
    {
        builder.ToTable("InventoryLedgerEntries");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.SkuNameSnapshot).HasMaxLength(255).IsRequired();
        builder.Property(e => e.ProductTypeSnapshot).HasMaxLength(30);
        builder.Property(e => e.InventoryUnitSnapshot).HasMaxLength(20);
        builder.Property(e => e.Location).HasMaxLength(20).IsRequired();
        builder.Property(e => e.TransactionType).HasMaxLength(50).IsRequired();
        builder.Property(e => e.SourceLocation).HasMaxLength(20);
        builder.Property(e => e.DestinationLocation).HasMaxLength(20);
        builder.Property(e => e.ReferenceType).HasMaxLength(50);
        builder.Property(e => e.ReferenceCode).HasMaxLength(50);
        builder.Property(e => e.LotCode).HasMaxLength(50);
        builder.Property(e => e.ActorName).HasMaxLength(255);
        builder.Property(e => e.ActorRole).HasMaxLength(100);
        builder.Property(e => e.Reason).HasMaxLength(500);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.CorrelationId).HasMaxLength(100);
        builder.HasIndex(e => e.TransactionGroupId);
        builder.HasIndex(e => e.OccurredAtUtc);
        builder.HasIndex(e => e.SkuId);
        builder.HasIndex(e => e.SkuCode);
        builder.HasIndex(e => e.Location);
        builder.HasIndex(e => e.TransactionType);
        builder.HasIndex(e => e.ReferenceCode);
        builder.HasIndex(e => e.ActorId);
        builder.HasIndex(e => e.CorrelationId);
        builder.HasIndex(e => e.BatchId);
    }
}

public class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> builder)
    {
        builder.ToTable("Suppliers");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.SupplierCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.NormalizedSupplierCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.Name).HasMaxLength(255).IsRequired();
        builder.Property(e => e.Phone).HasMaxLength(20);
        builder.Property(e => e.Email).HasMaxLength(255);
        builder.Property(e => e.Address).HasMaxLength(500);
        builder.Property(e => e.Note).HasMaxLength(1000);
        // Unique toàn hệ thống, không phân biệt hoa thường, không phụ thuộc collation toàn cục.
        builder.HasIndex(e => e.NormalizedSupplierCode).IsUnique();
        builder.HasIndex(e => e.IsDeleted);
        builder.HasIndex(e => e.Name);
    }
}

public class SupplierReceiptConfiguration : IEntityTypeConfiguration<SupplierReceipt>
{
    public void Configure(EntityTypeBuilder<SupplierReceipt> builder)
    {
        builder.ToTable("SupplierReceipts");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.ReceiptCode).HasMaxLength(30).IsRequired();
        builder.Property(e => e.SupplierName).HasMaxLength(255);
        builder.Property(e => e.SupplierNameSnapshot).HasMaxLength(255);
        builder.Property(e => e.SupplierCodeSnapshot).HasMaxLength(50);
        builder.Property(e => e.SupplierReference).HasMaxLength(100);
        builder.Property(e => e.SupplierDocumentNumber).HasMaxLength(100);
        builder.Property(e => e.DeliveredByName).HasMaxLength(255);
        builder.Property(e => e.OriginalDocumentReference).HasMaxLength(500);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.TotalAmount).HasColumnType("decimal(18,2)");
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(e => e.CreatedByName).HasMaxLength(255);
        builder.Property(e => e.CreatedByRoleName).HasMaxLength(100);
        builder.Property(e => e.ReviewedByName).HasMaxLength(255);
        builder.Property(e => e.ReviewedByRoleName).HasMaxLength(100);
        builder.Property(e => e.ReviewNote).HasMaxLength(500);
        builder.Property(e => e.StockImportSlipCode).HasMaxLength(30);
        builder.HasIndex(e => e.ReceiptCode).IsUnique();
        builder.HasIndex(e => e.SupplierId);
        builder.HasIndex(e => e.SupplierName);
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.CreatedBy);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasIndex(e => e.ReceivedDate);
        builder.HasIndex(e => e.StockImportSlipId);
        builder.HasMany(e => e.Items)
            .WithOne(i => i.SupplierReceipt)
            .HasForeignKey(i => i.SupplierReceiptId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class SupplierReceiptItemConfiguration : IEntityTypeConfiguration<SupplierReceiptItem>
{
    public void Configure(EntityTypeBuilder<SupplierReceiptItem> builder)
    {
        builder.ToTable("SupplierReceiptItems");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.SkuNameSnapshot).HasMaxLength(255).IsRequired();
        builder.Property(e => e.ProductTypeSnapshot).HasMaxLength(30).IsRequired();
        builder.Property(e => e.InventoryUnitSnapshot).HasMaxLength(20).IsRequired();
        builder.Property(e => e.SubmittedUnit).HasMaxLength(20);
        builder.Property(e => e.SubmittedQuantity).HasColumnType("decimal(18,3)");
        builder.Property(e => e.DocumentQuantity).HasColumnType("decimal(18,3)");
        builder.Property(e => e.UnitCost).HasColumnType("decimal(18,2)");
        builder.Property(e => e.LineAmount).HasColumnType("decimal(18,2)");
        builder.Property(e => e.LotCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.WarehouseBatchLotCode).HasMaxLength(50);
        builder.Property(e => e.QualityNote).HasMaxLength(500);
        builder.HasIndex(e => e.SupplierReceiptId);
        builder.HasIndex(e => e.SkuId);
        builder.HasIndex(e => e.LotCode);
        builder.HasIndex(e => e.WarehouseBatchId);
        builder.HasOne(e => e.WarehouseBatch)
            .WithMany()
            .HasForeignKey(e => e.WarehouseBatchId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class ShelfReturnRequestConfiguration : IEntityTypeConfiguration<ShelfReturnRequest>
{
    public void Configure(EntityTypeBuilder<ShelfReturnRequest> builder)
    {
        builder.ToTable("ShelfReturnRequests");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.ReturnCode).HasMaxLength(30).IsRequired();
        builder.Property(e => e.ReturnMode).HasMaxLength(30).IsRequired();
        builder.Property(e => e.OriginalStockAdjustmentRequestCode).HasMaxLength(30);
        builder.Property(e => e.Reason).HasMaxLength(500);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(e => e.CreatedByName).HasMaxLength(255);
        builder.Property(e => e.CreatedByRoleName).HasMaxLength(100);
        builder.Property(e => e.ReviewedByName).HasMaxLength(255);
        builder.Property(e => e.ReviewedByRoleName).HasMaxLength(100);
        builder.Property(e => e.ReviewNote).HasMaxLength(500);
        builder.HasIndex(e => e.ReturnCode).IsUnique();
        builder.HasIndex(e => e.ReturnMode);
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.CreatedBy);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasIndex(e => e.OriginalStockAdjustmentRequestId);
        builder.HasIndex(e => e.OriginalStockAdjustmentRequestCode);
        builder.HasMany(e => e.Items)
            .WithOne(i => i.ShelfReturnRequest)
            .HasForeignKey(i => i.ShelfReturnRequestId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ShelfReturnRequestItemConfiguration : IEntityTypeConfiguration<ShelfReturnRequestItem>
{
    public void Configure(EntityTypeBuilder<ShelfReturnRequestItem> builder)
    {
        builder.ToTable("ShelfReturnRequestItems");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.SkuSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.ShelfLotCode).HasMaxLength(50);
        builder.Property(e => e.StockExportSlipCode).HasMaxLength(30);
        builder.Property(e => e.StockImportSlipCode).HasMaxLength(30);
        builder.Property(e => e.WarehouseBatchLotCode).HasMaxLength(50);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.HasIndex(e => e.ShelfReturnRequestId);
        builder.HasIndex(e => e.SkuId);
        builder.HasIndex(e => e.ShelfBatchId);
        builder.HasIndex(e => e.WarehouseBatchId);
        builder.HasIndex(e => e.StockExportSlipId);
        builder.HasIndex(e => e.StockImportSlipId);
        builder.HasOne(e => e.ShelfBatch)
            .WithMany()
            .HasForeignKey(e => e.ShelfBatchId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(e => e.WarehouseBatch)
            .WithMany()
            .HasForeignKey(e => e.WarehouseBatchId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class SupplierReturnRequestConfiguration : IEntityTypeConfiguration<SupplierReturnRequest>
{
    public void Configure(EntityTypeBuilder<SupplierReturnRequest> builder)
    {
        builder.ToTable("SupplierReturnRequests");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.ReturnCode).HasMaxLength(30).IsRequired();
        builder.Property(e => e.ReturnMode).HasMaxLength(30).IsRequired();
        builder.Property(e => e.SupplierReceiptCode).HasMaxLength(30);
        builder.Property(e => e.SupplierName).HasMaxLength(255);
        builder.Property(e => e.SupplierReference).HasMaxLength(100);
        builder.Property(e => e.Reason).HasMaxLength(500);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(e => e.CreatedByName).HasMaxLength(255);
        builder.Property(e => e.CreatedByRoleName).HasMaxLength(100);
        builder.Property(e => e.ReviewedByName).HasMaxLength(255);
        builder.Property(e => e.ReviewedByRoleName).HasMaxLength(100);
        builder.Property(e => e.ReviewNote).HasMaxLength(500);
        builder.HasIndex(e => e.ReturnCode).IsUnique();
        builder.HasIndex(e => e.ReturnMode);
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.CreatedBy);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasIndex(e => e.SupplierReceiptId);
        builder.HasIndex(e => e.SupplierReceiptCode);
        builder.HasMany(e => e.Items)
            .WithOne(i => i.SupplierReturnRequest)
            .HasForeignKey(i => i.SupplierReturnRequestId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class SupplierReturnRequestItemConfiguration : IEntityTypeConfiguration<SupplierReturnRequestItem>
{
    public void Configure(EntityTypeBuilder<SupplierReturnRequestItem> builder)
    {
        builder.ToTable("SupplierReturnRequestItems");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.SkuSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.WarehouseBatchLotCode).HasMaxLength(50);
        builder.Property(e => e.StockExportSlipCode).HasMaxLength(30);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.HasIndex(e => e.SupplierReturnRequestId);
        builder.HasIndex(e => e.SkuId);
        builder.HasIndex(e => e.WarehouseBatchId);
        builder.HasIndex(e => e.StockExportSlipId);
        builder.HasOne(e => e.WarehouseBatch)
            .WithMany()
            .HasForeignKey(e => e.WarehouseBatchId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class ReturnInspectionConfiguration : IEntityTypeConfiguration<ReturnInspection>
{
    public void Configure(EntityTypeBuilder<ReturnInspection> builder)
    {
        builder.ToTable("ReturnInspections");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.ReturnCode).HasMaxLength(30).IsRequired();
        builder.Property(e => e.OrderCode).HasMaxLength(30).IsRequired();
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.SkuSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.Disposition).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(e => e.InspectionNote).HasMaxLength(500);
        builder.HasIndex(e => e.ReturnId);
        builder.HasIndex(e => e.OrderId);
        builder.HasIndex(e => e.SkuId);
        builder.HasIndex(e => e.Disposition);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasIndex(new[] { "ReturnId", "SkuId" })
            .HasDatabaseName("IX_ReturnInspections_ReturnId_SkuId");
        builder.HasOne(e => e.QuarantineBatch)
            .WithMany()
            .HasForeignKey(e => e.QuarantineBatchId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class StocktakeRequestConfiguration : IEntityTypeConfiguration<StocktakeRequest>
{
    public void Configure(EntityTypeBuilder<StocktakeRequest> builder)
    {
        builder.ToTable("StocktakeRequests");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.RequestCode).HasMaxLength(30).IsRequired();
        builder.Property(e => e.Location).HasMaxLength(20).IsRequired();
        builder.Property(e => e.Reason).HasMaxLength(500);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(e => e.CreatedByName).HasMaxLength(255);
        builder.Property(e => e.CreatedByRoleName).HasMaxLength(100);
        builder.Property(e => e.ReviewedByName).HasMaxLength(255);
        builder.Property(e => e.ReviewedByRoleName).HasMaxLength(100);
        builder.Property(e => e.ReviewNote).HasMaxLength(500);
        builder.HasIndex(e => e.RequestCode).IsUnique();
        builder.HasIndex(e => e.Location);
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.CreatedBy);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasIndex(e => e.CountDate);
        builder.HasIndex(e => e.SubmittedAt);
        builder.HasIndex(e => e.ReviewedAt);
        builder.HasMany(e => e.Items)
            .WithOne(i => i.Request)
            .HasForeignKey(i => i.StocktakeRequestId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class StocktakeRequestItemConfiguration : IEntityTypeConfiguration<StocktakeRequestItem>
{
    public void Configure(EntityTypeBuilder<StocktakeRequestItem> builder)
    {
        builder.ToTable("StocktakeRequestItems");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.SkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.SkuSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.ProductTypeSnapshot).HasMaxLength(30);
        builder.Property(e => e.InventoryUnitSnapshot).HasMaxLength(20);
        builder.Property(e => e.ReasonCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.StockExportSlipCode).HasMaxLength(30);
        builder.Property(e => e.StockImportSlipCode).HasMaxLength(30);
        builder.Property(e => e.WarehouseBatchLotCode).HasMaxLength(50);
        builder.HasIndex(e => e.StocktakeRequestId);
        builder.HasIndex(e => e.SkuId);
        builder.HasIndex(e => e.StockExportSlipId);
        builder.HasIndex(e => e.StockImportSlipId);
        builder.HasIndex(e => e.WarehouseBatchId);
        builder.HasOne(e => e.StockExportSlip)
            .WithMany()
            .HasForeignKey(e => e.StockExportSlipId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(e => e.StockImportSlip)
            .WithMany()
            .HasForeignKey(e => e.StockImportSlipId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(e => e.WarehouseBatch)
            .WithMany()
            .HasForeignKey(e => e.WarehouseBatchId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class ProductionOrderConfiguration : IEntityTypeConfiguration<ProductionOrder>
{
    public void Configure(EntityTypeBuilder<ProductionOrder> builder)
    {
        builder.ToTable("ProductionOrders");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.ProductionCode).HasMaxLength(30).IsRequired();
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.CreatedByName).HasMaxLength(255);
        builder.Property(e => e.CreatedByRoleName).HasMaxLength(100);
        builder.Property(e => e.ReviewedByName).HasMaxLength(255);
        builder.Property(e => e.ReviewedByRoleName).HasMaxLength(100);
        builder.Property(e => e.ReviewNote).HasMaxLength(500);
        builder.HasIndex(e => e.ProductionCode).IsUnique();
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasIndex(e => e.SubmittedAt);
        builder.HasIndex(e => e.ReviewedBy);
        builder.HasIndex(e => e.ReviewedAt);
        builder.HasMany(e => e.Lines)
            .WithOne(l => l.Order)
            .HasForeignKey(l => l.ProductionOrderId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(e => e.OutputLines)
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

public class ProductionOrderOutputLineConfiguration : IEntityTypeConfiguration<ProductionOrderOutputLine>
{
    public void Configure(EntityTypeBuilder<ProductionOrderOutputLine> builder)
    {
        builder.ToTable("ProductionOrderOutputLines");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.FinishedSkuCode).HasMaxLength(50).IsRequired();
        builder.Property(e => e.FinishedSkuSnapshotName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.PlannedQuantity).IsRequired();
        builder.Property(e => e.ExpiresAt);
        builder.Property(e => e.DestinationLocation).HasMaxLength(20).HasDefaultValue("Warehouse").IsRequired();
        builder.Property(e => e.WarehouseBatchLotCode).HasMaxLength(50);
        builder.HasIndex(e => e.ProductionOrderId);
        builder.HasIndex(e => e.FinishedSkuId);
        builder.HasIndex(e => e.DestinationLocation);
        builder.HasIndex(e => new { e.ProductionOrderId, e.FinishedSkuId }).IsUnique();
        builder.HasIndex(e => e.WarehouseBatchId);
        builder.HasOne(e => e.WarehouseBatch)
            .WithMany()
            .HasForeignKey(e => e.WarehouseBatchId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class ProcessedIntegrationEventConfiguration : IEntityTypeConfiguration<ProcessedIntegrationEvent>
{
    public void Configure(EntityTypeBuilder<ProcessedIntegrationEvent> builder)
    {
        builder.ToTable("ProcessedIntegrationEvents");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.EventType).HasMaxLength(100).IsRequired();
        builder.Property(e => e.EventId);
        builder.HasIndex(e => new { e.EventType, e.CorrelationId }).IsUnique();
        // G6: EventId là khoá chống trùng có thẩm quyền. Unique để race hai lần giao
        // cùng EventId không thể ghi hai inbox row (INSERT thứ hai vi phạm unique).
        builder.HasIndex(e => e.EventId)
            .IsUnique()
            .HasDatabaseName("IX_ProcessedIntegrationEvents_EventId");
    }
}
