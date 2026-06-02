using HuongVanTra.Core.Entities.Inventory;
using HuongVanTra.Core.Entities.System;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Sales.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace HuongVanTra.Service.Sales {
    public class StockDeductQueueService : IStockDeductQueueService {
        private readonly AppDbContext _db;

        public StockDeductQueueService(AppDbContext db) {
            _db = db;
        }

        public async Task<ConfirmStockDeductResult> ConfirmAsync(int queueId, int confirmedByEmployeeId) {
            var queue = await _db.StockDeductQueues
                .Include(q => q.Order)
                .FirstOrDefaultAsync(q => q.Id == queueId)
                ?? throw new ArgumentException($"Stock deduct queue {queueId} does not exist.");

            if (queue.Status != "waiting")
                throw new InvalidOperationException(
                    $"Queue {queueId} cannot be confirmed: current status is '{queue.Status}'.");

            var order = queue.Order;

            var snapshot = JsonSerializer.Deserialize<List<BomSnapshotEntry>>(queue.BomSnapshot)
                ?? throw new InvalidOperationException("BOM snapshot is invalid or empty.");

            var warehouse = await _db.Warehouses
                .FirstOrDefaultAsync(w => w.StoreId == order.StoreId)
                ?? throw new InvalidOperationException($"No warehouse found for store {order.StoreId}.");

            await using var tx = await _db.Database.BeginTransactionAsync();
            try {
                await DeductBySnapshotAsync(snapshot, warehouse.Id, order, confirmedByEmployeeId);

                queue.Status        = "confirmed";
                queue.ConfirmedById = confirmedByEmployeeId;
                queue.ConfirmedAt   = DateTime.UtcNow;
                order.StockStatus   = "deducted";

                _db.AuditLogs.Add(new AuditLog {
                    Action     = "confirm_stock_deduct",
                    EntityType = "stock_deduct_queue",
                    EntityId   = queue.Id,
                    UserId     = confirmedByEmployeeId,
                    StoreId    = order.StoreId,
                    Status     = "SUCCESS",
                    CreatedAt  = DateTime.UtcNow
                });

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                return new ConfirmStockDeductResult {
                    QueueId          = queue.Id,
                    OrderId          = order.Id,
                    OrderCode        = order.OrderCode,
                    QueueStatus      = queue.Status,
                    OrderStockStatus = order.StockStatus,
                    ConfirmedAt      = queue.ConfirmedAt!.Value
                };
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        private async Task DeductBySnapshotAsync(
            List<BomSnapshotEntry> snapshot,
            int warehouseId,
            Core.Entities.Sales.Order order,
            int cashierId) {

            // Aggregate by materialId in case snapshot has multiple entries for same material
            var deductMap = snapshot
                .GroupBy(e => e.MaterialId)
                .ToDictionary(g => g.Key, g => g.Sum(e => e.Quantity));

            if (deductMap.Count == 0) {
                throw new InvalidOperationException("No inventory items to deduct for this order.");
            }

            var materialIds = deductMap.Keys.ToList();
            var balances = await _db.InventoryBalances
                .Where(b => b.WarehouseId == warehouseId && materialIds.Contains(b.ProductId))
                .ToDictionaryAsync(b => b.ProductId);

            var txnCode = $"TXN-{order.OrderCode}";

            foreach (var (materialId, qty) in deductMap) {
                if (!balances.TryGetValue(materialId, out var balance)) {
                    balance = new InventoryBalance {
                        WarehouseId = warehouseId,
                        ProductId   = materialId,
                        Quantity    = 0
                    };
                    _db.InventoryBalances.Add(balance);
                    await _db.SaveChangesAsync();
                    balances[materialId] = balance;
                }

                var before = balance.Quantity;
                var after  = before - qty;

                if (after < 0)
                    throw new InvalidOperationException(
                        $"Insufficient stock for product {materialId}: available {before}, required {qty}.");

                balance.Quantity = after;

                _db.InventoryTransactions.Add(new InventoryTransaction {
                    TxnCode        = $"{txnCode}-{materialId}",
                    WarehouseId    = warehouseId,
                    ProductId      = materialId,
                    TxnType        = "OUT",
                    Quantity       = qty,
                    QuantityBefore = before,
                    QuantityAfter  = after,
                    RefType        = "ORDER",
                    RefId          = order.Id,
                    CreatedById    = cashierId,
                    CreatedAt      = DateTime.UtcNow
                });
            }
        }

        private class BomSnapshotEntry {
            public int     ProductId  { get; set; }
            public int     MaterialId { get; set; }
            public decimal Quantity   { get; set; }
        }
    }
}
