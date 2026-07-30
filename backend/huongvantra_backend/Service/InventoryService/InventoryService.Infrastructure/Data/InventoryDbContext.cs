using InventoryService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Data;

public class InventoryDbContext(DbContextOptions<InventoryDbContext> options) : DbContext(options)
{
    public DbSet<SkuStock> SkuStocks => Set<SkuStock>();
    public DbSet<StockDeductQueue> StockDeductQueues => Set<StockDeductQueue>();
    public DbSet<StockDeductQueueItem> StockDeductQueueItems => Set<StockDeductQueueItem>();
    public DbSet<ProcessedIntegrationEvent> ProcessedIntegrationEvents => Set<ProcessedIntegrationEvent>();
    public DbSet<InventoryOutboxMessage> InventoryOutboxMessages => Set<InventoryOutboxMessage>();
    public DbSet<StockAdjustmentRequest> StockAdjustmentRequests => Set<StockAdjustmentRequest>();
    public DbSet<StockAdjustmentRequestItem> StockAdjustmentRequestItems => Set<StockAdjustmentRequestItem>();
    public DbSet<StockExportSlip> StockExportSlips => Set<StockExportSlip>();
    public DbSet<StockExportSlipLine> StockExportSlipLines => Set<StockExportSlipLine>();
    public DbSet<StockImportSlip> StockImportSlips => Set<StockImportSlip>();
    public DbSet<StockImportSlipLine> StockImportSlipLines => Set<StockImportSlipLine>();
    public DbSet<WarehouseBatch> WarehouseBatches => Set<WarehouseBatch>();
    public DbSet<WarehouseBatchItem> WarehouseBatchItems => Set<WarehouseBatchItem>();
    public DbSet<StockExportBatchAllocation> StockExportBatchAllocations => Set<StockExportBatchAllocation>();
    public DbSet<InventoryLedgerEntry> InventoryLedgerEntries => Set<InventoryLedgerEntry>();
    public DbSet<SupplierReceipt> SupplierReceipts => Set<SupplierReceipt>();
    public DbSet<SupplierReceiptItem> SupplierReceiptItems => Set<SupplierReceiptItem>();
    public DbSet<ShelfReturnRequest> ShelfReturnRequests => Set<ShelfReturnRequest>();
    public DbSet<ShelfReturnRequestItem> ShelfReturnRequestItems => Set<ShelfReturnRequestItem>();
    public DbSet<SupplierReturnRequest> SupplierReturnRequests => Set<SupplierReturnRequest>();
    public DbSet<SupplierReturnRequestItem> SupplierReturnRequestItems => Set<SupplierReturnRequestItem>();
    public DbSet<StocktakeRequest> StocktakeRequests => Set<StocktakeRequest>();
    public DbSet<StocktakeRequestItem> StocktakeRequestItems => Set<StocktakeRequestItem>();
    public DbSet<ProductionOrder> ProductionOrders => Set<ProductionOrder>();
    public DbSet<ProductionOrderLine> ProductionOrderLines => Set<ProductionOrderLine>();
    public DbSet<ProductionOrderOutputLine> ProductionOrderOutputLines => Set<ProductionOrderOutputLine>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<ReturnInspection> ReturnInspections => Set<ReturnInspection>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(InventoryDbContext).Assembly);
    }
}
