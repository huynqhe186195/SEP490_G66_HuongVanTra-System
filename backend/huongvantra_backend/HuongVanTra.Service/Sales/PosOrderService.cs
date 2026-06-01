using HuongVanTra.Core.Entities.Inventory;
using HuongVanTra.Core.Entities.Sales;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Sales.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace HuongVanTra.Service.Sales {
    public class PosOrderService : IPosOrderService {
        private readonly AppDbContext _db;

        public PosOrderService(AppDbContext db) {
            _db = db;
        }

        public async Task<PosOrderResult> CreateOnlineOrderAsync(CreatePosOrderCommand command) {
            await ValidateCommandAsync(command);

            var productPrices = await GetProductPricesAsync(command);
            var discount = await GetDiscountAsync(command.PromotionId);

            await using var tx = await _db.Database.BeginTransactionAsync();
            try {
                var order = BuildOrder(command, productPrices, discount);
                order.StockStatus = "PENDING";

                _db.Orders.Add(order);
                await _db.SaveChangesAsync();

                // Snapshot BOM at time of sale so deduction is deterministic later
                var bomSnapshot = await BuildBomSnapshotAsync(command);

                _db.StockDeductQueues.Add(new StockDeductQueue {
                    OrderId = order.Id,
                    Status = "PENDING",
                    BomSnapshot = JsonSerializer.Serialize(bomSnapshot),
                    CreatedAt = DateTime.UtcNow
                });

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                return ToResult(order);
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        public async Task<PosOrderResult> CreateOfflineOrderAsync(CreatePosOrderCommand command) {
            await ValidateCommandAsync(command);

            var productPrices = await GetProductPricesAsync(command);
            var discount = await GetDiscountAsync(command.PromotionId);

            var warehouse = await _db.Warehouses
                .FirstOrDefaultAsync(w => w.StoreId == command.StoreId)
                ?? throw new InvalidOperationException($"No warehouse found for store {command.StoreId}.");

            await using var tx = await _db.Database.BeginTransactionAsync();
            try {
                var order = BuildOrder(command, productPrices, discount);
                order.StockStatus = "DEDUCTED";

                _db.Orders.Add(order);
                await _db.SaveChangesAsync();

                await DeductInventoryAsync(order, warehouse.Id, command.CashierId);

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                return ToResult(order);
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        // ── helpers ──────────────────────────────────────────────────────────

        private async Task ValidateCommandAsync(CreatePosOrderCommand command) {
            if (command.Items.Count == 0)
                throw new ArgumentException("Order must have at least one item.");

            if (command.Payments.Count == 0)
                throw new ArgumentException("Order must have at least one payment.");

            var productIds = command.Items.Select(i => i.ProductId).Distinct().ToList();
            var existingCount = await _db.Products.CountAsync(p => productIds.Contains(p.Id));
            if (existingCount != productIds.Count)
                throw new ArgumentException("One or more products do not exist.");
        }

        private async Task<Dictionary<int, decimal>> GetProductPricesAsync(CreatePosOrderCommand command) {
            var productIds = command.Items.Select(i => i.ProductId).Distinct().ToList();
            return await _db.Products
                .Where(p => productIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.Price);
        }

        private async Task<(string type, decimal value)> GetDiscountAsync(int? promotionId) {
            if (promotionId is null) return ("NONE", 0);

            var promo = await _db.OrderPromotions.FindAsync(promotionId.Value);
            if (promo is null) return ("NONE", 0);

            return (promo.DiscountType, promo.DiscountValue);
        }

        private static Order BuildOrder(
            CreatePosOrderCommand command,
            Dictionary<int, decimal> prices,
            (string type, decimal value) discount) {

            var items = command.Items.Select(i => new OrderItem {
                ProductId = i.ProductId,
                Quantity = i.Quantity,
                LineTotal = i.IsGift == 1 ? 0 : prices[i.ProductId] * i.Quantity,
                IsGift = i.IsGift
            }).ToList();

            var subtotal = items.Sum(i => i.LineTotal);
            var totalAmount = discount.type switch {
                "PERCENTAGE" => subtotal * (1 - discount.value / 100),
                "FIXED"      => Math.Max(0, subtotal - discount.value),
                _            => subtotal
            };

            var payments = command.Payments.Select(p => new PaymentTransaction {
                PaymentMethod = p.PaymentMethod,
                Amount = p.Amount,
                TransactionDate = DateTime.UtcNow
            }).ToList();

            return new Order {
                OrderCode = GenerateOrderCode(),
                StoreId = command.StoreId,
                CustomerId = command.CustomerId,
                CashierId = command.CashierId,
                PromotionId = command.PromotionId,
                TotalAmount = totalAmount,
                PaymentStatus = "PAID",
                OrderStatus = "COMPLETED",
                CreatedAt = DateTime.UtcNow,
                OrderItems = items,
                PaymentTransactions = payments
            };
        }

        private async Task DeductInventoryAsync(Order order, int warehouseId, int cashierId) {
            var productIds = order.OrderItems
                .Where(i => i.IsGift == 0)
                .Select(i => i.ProductId)
                .Distinct()
                .ToList();

            // Load BOM headers for finished goods
            var bomHeaders = await _db.BomHeaders
                .Include(b => b.BomLines)
                .Where(b => productIds.Contains(b.FinishedGoodId))
                .ToDictionaryAsync(b => b.FinishedGoodId);

            // Build material deduction map: materialId -> total qty to deduct
            var deductMap = new Dictionary<int, decimal>();

            foreach (var item in order.OrderItems.Where(i => i.IsGift == 0)) {
                if (bomHeaders.TryGetValue(item.ProductId, out var bom)) {
                    // Finished good: deduct raw materials via BOM
                    var multiplier = item.Quantity / bom.QuantityOutput;
                    foreach (var line in bom.BomLines) {
                        deductMap.TryGetValue(line.MaterialId, out var existing);
                        deductMap[line.MaterialId] = existing + line.Quantity * multiplier;
                    }
                }
                else {
                    // Raw material / simple product: deduct directly
                    deductMap.TryGetValue(item.ProductId, out var existing);
                    deductMap[item.ProductId] = existing + item.Quantity;
                }
            }

            var materialIds = deductMap.Keys.ToList();
            var balances = await _db.InventoryBalances
                .Where(b => b.WarehouseId == warehouseId && materialIds.Contains(b.ProductId))
                .ToDictionaryAsync(b => b.ProductId);

            var txnCode = $"TXN-{order.OrderCode}";

            foreach (var (materialId, qty) in deductMap) {
                if (!balances.TryGetValue(materialId, out var balance)) {
                    // Create balance row at zero if it doesn't exist yet
                    balance = new InventoryBalance {
                        WarehouseId = warehouseId,
                        ProductId = materialId,
                        Quantity = 0
                    };
                    _db.InventoryBalances.Add(balance);
                    await _db.SaveChangesAsync(); // flush so we have the Id
                    balances[materialId] = balance;
                }

                var before = balance.Quantity;
                var after = before - qty;

                if (after < 0)
                    throw new InvalidOperationException(
                        $"Insufficient stock for product {materialId}: available {before}, required {qty}.");

                balance.Quantity = after;

                _db.InventoryTransactions.Add(new InventoryTransaction {
                    TxnCode = $"{txnCode}-{materialId}",
                    WarehouseId = warehouseId,
                    ProductId = materialId,
                    TxnType = "OUT",
                    Quantity = qty,
                    QuantityBefore = before,
                    QuantityAfter = after,
                    RefType = "ORDER",
                    RefId = order.Id,
                    CreatedById = cashierId,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        private async Task<List<BomSnapshotEntry>> BuildBomSnapshotAsync(CreatePosOrderCommand command) {
            var productIds = command.Items.Select(i => i.ProductId).Distinct().ToList();

            var bomHeaders = await _db.BomHeaders
                .Include(b => b.BomLines)
                .Where(b => productIds.Contains(b.FinishedGoodId))
                .ToListAsync();

            var snapshot = new List<BomSnapshotEntry>();

            foreach (var item in command.Items.Where(i => i.IsGift == 0)) {
                var bom = bomHeaders.FirstOrDefault(b => b.FinishedGoodId == item.ProductId);
                if (bom is not null) {
                    var multiplier = item.Quantity / bom.QuantityOutput;
                    foreach (var line in bom.BomLines) {
                        snapshot.Add(new BomSnapshotEntry {
                            ProductId = item.ProductId,
                            MaterialId = line.MaterialId,
                            Quantity = line.Quantity * multiplier
                        });
                    }
                }
                else {
                    snapshot.Add(new BomSnapshotEntry {
                        ProductId = item.ProductId,
                        MaterialId = item.ProductId,
                        Quantity = item.Quantity
                    });
                }
            }

            return snapshot;
        }

        private static string GenerateOrderCode() {
            var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
            var suffix = Guid.NewGuid().ToString("N")[..6].ToUpper();
            return $"POS-{timestamp}-{suffix}";
        }

        private static PosOrderResult ToResult(Order order) => new() {
            OrderId = order.Id,
            OrderCode = order.OrderCode,
            TotalAmount = order.TotalAmount,
            PaymentStatus = order.PaymentStatus,
            StockStatus = order.StockStatus,
            OrderStatus = order.OrderStatus,
            CreatedAt = order.CreatedAt,
            Items = order.OrderItems.Select(i => new PosOrderItemResult {
                ProductId = i.ProductId,
                Quantity = i.Quantity,
                LineTotal = i.LineTotal,
                IsGift = i.IsGift
            }).ToList()
        };

        private class BomSnapshotEntry {
            public int ProductId { get; set; }
            public int MaterialId { get; set; }
            public decimal Quantity { get; set; }
        }
    }
}
