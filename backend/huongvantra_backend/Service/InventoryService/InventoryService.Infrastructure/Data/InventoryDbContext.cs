using InventoryService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Data;

public class InventoryDbContext(DbContextOptions<InventoryDbContext> options) : DbContext(options)
{
    public DbSet<SkuStock> SkuStocks => Set<SkuStock>();
    public DbSet<StockDeductQueue> StockDeductQueues => Set<StockDeductQueue>();
    public DbSet<StockDeductQueueItem> StockDeductQueueItems => Set<StockDeductQueueItem>();
    public DbSet<ProcessedIntegrationEvent> ProcessedIntegrationEvents => Set<ProcessedIntegrationEvent>();
    public DbSet<StockAdjustmentRequest> StockAdjustmentRequests => Set<StockAdjustmentRequest>();
    public DbSet<StockExportSlip> StockExportSlips => Set<StockExportSlip>();
    public DbSet<WarehouseBatch> WarehouseBatches => Set<WarehouseBatch>();
    public DbSet<WarehouseBatchItem> WarehouseBatchItems => Set<WarehouseBatchItem>();
    public DbSet<StockExportBatchAllocation> StockExportBatchAllocations => Set<StockExportBatchAllocation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(InventoryDbContext).Assembly);
    }
}
