using HuongVanTra.Core.Constants;
using HuongVanTra.Core.Entities.Inventory;
using HuongVanTra.Core.Entities.Sales;
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

        public async Task<IReadOnlyList<StockDeductQueueListItem>> GetWaitingAsync(
            CancellationToken cancellationToken = default) {
            return await _db.StockDeductQueues
                .AsNoTracking()
                .Where(q => q.Status == QueueStatus.Waiting)
                .OrderByDescending(q => q.CreatedAt)
                .Select(q => new StockDeductQueueListItem {
                    QueueId            = q.Id,
                    OrderId            = q.Order.Id,
                    OrderCode          = q.Order.OrderCode,
                    QueueStatus        = q.Status,
                    OrderPaymentStatus = q.Order.PaymentStatus,
                    OrderStockStatus   = q.Order.StockStatus,
                    TotalAmount        = q.Order.TotalAmount,
                    CreatedAt          = q.CreatedAt,
                })
                .ToListAsync(cancellationToken);
        }

        public async Task<PreviewStockDeductResult> PreviewAsync(
            int queueId, CancellationToken cancellationToken = default) {

            var queue = await _db.StockDeductQueues
                .AsNoTracking()
                .Include(q => q.Order)
                .FirstOrDefaultAsync(q => q.Id == queueId, cancellationToken)
                ?? throw new ArgumentException($"Stock deduct queue {queueId} does not exist.");

            var order = queue.Order;

            var snapshot = JsonSerializer.Deserialize<List<BomSnapshotEntry>>(queue.BomSnapshot)
                ?? throw new InvalidOperationException("BOM snapshot is invalid or empty.");

            var warehouse = await _db.Warehouses
                .AsNoTracking()
                .FirstOrDefaultAsync(w => w.StoreId == order.StoreId, cancellationToken)
                ?? throw new InvalidOperationException($"No warehouse found for store {order.StoreId}.");

            var deductMap = snapshot
                .GroupBy(e => e.MaterialId)
                .ToDictionary(
                    g => g.Key,
                    g => new { ProductId = g.First().ProductId, Quantity = g.Sum(e => e.Quantity) });

            var materialIds = deductMap.Keys.ToList();
            var balances = await _db.InventoryBalances
                .AsNoTracking()
                .Where(b => b.WarehouseId == warehouse.Id && materialIds.Contains(b.ProductId))
                .ToDictionaryAsync(b => b.ProductId, cancellationToken);

            var materialNames = await _db.Products
                .AsNoTracking()
                .Where(p => materialIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);

            var items = deductMap.Select(kvp => {
                var materialId = kvp.Key;
                var required   = kvp.Value.Quantity;
                var available  = balances.TryGetValue(materialId, out var bal) ? bal.Quantity : 0;
                var shortage   = Math.Max(0, required - available);
                return new PreviewStockDeductItem {
                    ProductId        = kvp.Value.ProductId,
                    MaterialId       = materialId,
                    MaterialName     = materialNames.TryGetValue(materialId, out var name) ? name : null,
                    RequiredQuantity = required,
                    AvailableQuantity = available,
                    ShortageQuantity = shortage,
                    Status           = shortage > 0 ? "insufficient" : "available"
                };
            }).ToList();

            return new PreviewStockDeductResult {
                QueueId          = queue.Id,
                OrderId          = order.Id,
                OrderCode        = order.OrderCode,
                QueueStatus      = queue.Status,
                OrderStockStatus = order.StockStatus,
                CanDeduct        = items.All(i => i.ShortageQuantity == 0),
                Items            = items
            };
        }

        public async Task<ConfirmStockDeductResult> ConfirmAsync(int queueId, int confirmedByEmployeeId) {
            var queue = await _db.StockDeductQueues
                .Include(q => q.Order)
                .FirstOrDefaultAsync(q => q.Id == queueId)
                ?? throw new ArgumentException($"Stock deduct queue {queueId} does not exist.");

            if (queue.Status != QueueStatus.Waiting)
                throw new InvalidOperationException(
                    $"Queue {queueId} cannot be confirmed: current status is '{queue.Status}'.");

            var order = queue.Order;

            var snapshot = JsonSerializer.Deserialize<List<BomSnapshotEntry>>(queue.BomSnapshot)
                ?? throw new InvalidOperationException("BOM snapshot is invalid or empty.");

            var warehouse = await _db.Warehouses
                .FirstOrDefaultAsync(w => w.StoreId == order.StoreId)
                ?? throw new InvalidOperationException($"No warehouse found for store {order.StoreId}.");

            var deductMap = snapshot
                .GroupBy(e => e.MaterialId)
                .ToDictionary(
                    g => g.Key,
                    g => new { ProductId = g.First().ProductId, Quantity = g.Sum(e => e.Quantity) });

            if (deductMap.Count == 0)
                throw new InvalidOperationException("No inventory items to deduct for this order.");

            var materialIds = deductMap.Keys.ToList();
            var balances = await _db.InventoryBalances
                .Where(b => b.WarehouseId == warehouse.Id && materialIds.Contains(b.ProductId))
                .ToDictionaryAsync(b => b.ProductId);

            // Check for shortages first
            var shortageItems = new List<ShortageItem>();
            foreach (var (materialId, info) in deductMap) {
                var available = balances.TryGetValue(materialId, out var bal) ? bal.Quantity : 0;
                var shortage  = Math.Max(0, info.Quantity - available);
                if (shortage > 0) {
                    shortageItems.Add(new ShortageItem {
                        ProductId         = info.ProductId,
                        MaterialId        = materialId,
                        RequiredQuantity  = info.Quantity,
                        AvailableQuantity = available,
                        ShortageQuantity  = shortage
                    });
                }
            }

            await using var tx = await _db.Database.BeginTransactionAsync();
            try {
                if (shortageItems.Count > 0) {
                    // Lưu shortage records, không trừ kho
                    var now = DateTime.UtcNow;
                    foreach (var s in shortageItems) {
                        _db.OrderStockShortages.Add(new OrderStockShortage {
                            QueueId           = queue.Id,
                            OrderId           = order.Id,
                            ProductId         = s.ProductId,
                            MaterialId        = s.MaterialId,
                            WarehouseId       = warehouse.Id,
                            RequiredQuantity  = s.RequiredQuantity,
                            AvailableQuantity = s.AvailableQuantity,
                            ShortageQuantity  = s.ShortageQuantity,
                            Status            = ShortageStatus.WaitingStock,
                            CreatedAt         = now
                        });
                    }

                    queue.Status      = QueueStatus.Insufficient;
                    order.StockStatus = OrderStockStatus.WaitingStock;

                    _db.AuditLogs.Add(new AuditLog {
                        Action     = "confirm_stock_deduct_insufficient",
                        EntityType = "stock_deduct_queue",
                        EntityId   = queue.Id,
                        UserId     = confirmedByEmployeeId,
                        StoreId    = order.StoreId,
                        Status     = "INSUFFICIENT",
                        CreatedAt  = now
                    });

                    await _db.SaveChangesAsync();
                    await tx.CommitAsync();

                    throw new InsufficientStockException(new InsufficientStockResult {
                        QueueId          = queue.Id,
                        OrderId          = order.Id,
                        OrderStockStatus = order.StockStatus,
                        Shortages        = shortageItems
                    });
                }

                // Đủ hàng — trừ kho
                var txnCode = $"TXN-{order.OrderCode}";
                foreach (var (materialId, info) in deductMap) {
                    if (!balances.TryGetValue(materialId, out var balance)) {
                        balance = new InventoryBalance {
                            WarehouseId = warehouse.Id,
                            ProductId   = materialId,
                            Quantity    = 0
                        };
                        _db.InventoryBalances.Add(balance);
                        await _db.SaveChangesAsync();
                        balances[materialId] = balance;
                    }

                    var before = balance.Quantity;
                    var after  = before - info.Quantity;
                    balance.Quantity = after;

                    _db.InventoryTransactions.Add(new InventoryTransaction {
                        TxnCode        = $"{txnCode}-{materialId}",
                        WarehouseId    = warehouse.Id,
                        ProductId      = materialId,
                        TxnType        = "OUT",
                        Quantity       = info.Quantity,
                        QuantityBefore = before,
                        QuantityAfter  = after,
                        RefType        = "ORDER",
                        RefId          = order.Id,
                        CreatedById    = confirmedByEmployeeId,
                        CreatedAt      = DateTime.UtcNow
                    });
                }

                queue.Status        = QueueStatus.Confirmed;
                queue.ConfirmedById = confirmedByEmployeeId;
                queue.ConfirmedAt   = DateTime.UtcNow;
                order.StockStatus   = OrderStockStatus.Deducted;

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
            catch (InsufficientStockException) {
                throw;
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        public async Task<CancelStockDeductResult> CancelAsync(
            int queueId, int cancelledByEmployeeId, string? reason) {

            var queue = await _db.StockDeductQueues
                .Include(q => q.Order)
                .FirstOrDefaultAsync(q => q.Id == queueId)
                ?? throw new ArgumentException($"Stock deduct queue {queueId} does not exist.");

            if (queue.Status == QueueStatus.Confirmed)
                throw new InvalidOperationException(
                    $"Queue {queueId} has already been confirmed and cannot be cancelled. " +
                    "Stock has been deducted — a separate reversal flow is required.");

            if (queue.Status == QueueStatus.Cancelled)
                throw new InvalidOperationException(
                    $"Queue {queueId} is already cancelled.");

            var order = queue.Order;
            var now   = DateTime.UtcNow;

            await using var tx = await _db.Database.BeginTransactionAsync();
            try {
                // Cancel related shortages if any
                var shortages = await _db.OrderStockShortages
                    .Where(s => s.QueueId == queueId && s.Status == ShortageStatus.WaitingStock)
                    .ToListAsync();
                foreach (var s in shortages) {
                    s.Status     = ShortageStatus.Cancelled;
                    s.ResolvedAt = now;
                    if (reason is not null) s.Note = reason;
                }

                queue.Status      = QueueStatus.Cancelled;
                order.StockStatus = OrderStockStatus.Cancelled;

                _db.AuditLogs.Add(new AuditLog {
                    Action     = "cancel_stock_deduct_queue",
                    EntityType = "stock_deduct_queue",
                    EntityId   = queue.Id,
                    UserId     = cancelledByEmployeeId,
                    StoreId    = order.StoreId,
                    Status     = "SUCCESS",
                    CreatedAt  = now
                });

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                return new CancelStockDeductResult {
                    QueueId          = queue.Id,
                    OrderId          = order.Id,
                    OrderCode        = order.OrderCode,
                    QueueStatus      = queue.Status,
                    OrderStockStatus = order.StockStatus,
                    CancelledAt      = now
                };
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        private class BomSnapshotEntry {
            public int     ProductId  { get; set; }
            public int     MaterialId { get; set; }
            public decimal Quantity   { get; set; }
        }
    }
}
