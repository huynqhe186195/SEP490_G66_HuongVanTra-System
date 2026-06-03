using HuongVanTra.Core.Entities.Inventory;
using HuongVanTra.Core.Entities.Sales;
using HuongVanTra.Core.Entities.System;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Sales.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace HuongVanTra.Service.Sales {
    public class PosOrderService : IPosOrderService {
        private readonly AppDbContext _db;
        private readonly IVietQrService _vietQrService;

        public PosOrderService(AppDbContext db, IVietQrService vietQrService) {
            _db = db;
            _vietQrService = vietQrService;
        }

        public async Task<PosOrderResult> CreateOnlineOrderAsync(CreatePosOrderCommand command) {
            var (productMap, discount, membershipDiscount) = await ValidateAndLoadAsync(command);

            await using var tx = await _db.Database.BeginTransactionAsync();
            try {
                var order = BuildOrder(command, productMap, discount, membershipDiscount);
                order.StockStatus = "pending_deduct";
                order.PaymentStatus = "pending_payment";
                order.OrderStatus = "confirmed";

                _db.Orders.Add(order);
                await _db.SaveChangesAsync();

                var bomSnapshot = await BuildBomSnapshotAsync(command);
                _db.StockDeductQueues.Add(new StockDeductQueue {
                    OrderId = order.Id,
                    Status = "waiting",
                    BomSnapshot = JsonSerializer.Serialize(bomSnapshot),
                    CreatedAt = DateTime.UtcNow
                });

                await UpdateCustomerSpendAsync(command.CustomerId, order.TotalAmount);
                await WriteAuditLogAsync("create", "orders", order.Id, command.CashierId, command.StoreId);

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                var result = ToResult(order);
                if (HasTransferPayment(command)) {
                    var qr = await _vietQrService.GenerateForOrderAsync(order.OrderCode, order.TotalAmount);
                    result.QrImageUrl = qr.QrImageUrl;
                    result.QrPayload = qr.QrPayload;
                    result.TransferContent = qr.TransferContent;
                }

                return result;
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        public async Task<PosOrderResult> CreateOfflineOrderAsync(CreatePosOrderCommand command) {
            var (productMap, discount, membershipDiscount) = await ValidateAndLoadAsync(command);

            var warehouse = await _db.Warehouses
                .FirstOrDefaultAsync(w => w.StoreId == command.StoreId)
                ?? throw new InvalidOperationException($"No warehouse found for store {command.StoreId}.");

            await using var tx = await _db.Database.BeginTransactionAsync();
            try {
                var order = BuildOrder(command, productMap, discount, membershipDiscount);
                order.StockStatus = "deducted";
                order.PaymentStatus = "pending_payment";
                order.OrderStatus = "confirmed";

                _db.Orders.Add(order);
                await _db.SaveChangesAsync();

                await DeductInventoryAsync(order, warehouse.Id, command.CashierId);
                await UpdateCustomerSpendAsync(command.CustomerId, order.TotalAmount);
                await WriteAuditLogAsync("create", "orders", order.Id, command.CashierId, command.StoreId);

                string? invoiceCode = null;
                if (IsFullCashPayment(command, order.TotalAmount)) {
                    invoiceCode = ApplyPaidState(order, command.CashierId, $"POS-CASH-{order.OrderCode}");
                }

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                var result = ToResult(order);
                result.InvoiceCode = invoiceCode;
                return result;
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        // ── validation & data loading ────────────────────────────────────────

        private async Task<(Dictionary<int, (string Name, string Sku, decimal Price)> productMap,
                            (string type, decimal value) discount,
                            decimal membershipDiscount)>
            ValidateAndLoadAsync(CreatePosOrderCommand command) {

            if (command.Items.Count == 0)
                throw new ArgumentException("Order must have at least one item.");
            if (command.Payments.Count == 0)
                throw new ArgumentException("Order must have at least one payment.");

            var storeExists = await _db.Stores.AnyAsync(s => s.Id == command.StoreId);
            if (!storeExists)
                throw new ArgumentException($"Store {command.StoreId} does not exist.");

            if (command.CustomerId <= 0)
                throw new ArgumentException("CustomerId is required for POS orders.");

            var customerExists = await _db.Customers.AnyAsync(c => c.Id == command.CustomerId);
            if (!customerExists)
                throw new ArgumentException($"Customer {command.CustomerId} does not exist.");

            var productIds = command.Items.Select(i => i.ProductId).Distinct().ToList();
            var products = await _db.Products
                .Where(p => productIds.Contains(p.Id))
                .Select(p => new { p.Id, p.Name, p.Sku, p.Price })
                .ToListAsync();

            if (products.Count != productIds.Count)
                throw new ArgumentException("One or more products do not exist.");

            var productMap = products.ToDictionary(
                p => p.Id,
                p => (Name: p.Name, Sku: p.Sku, Price: p.Price));

            var discount = await GetDiscountAsync(command.PromotionId);
            var membershipDiscount = await GetMembershipDiscountAsync(command.CustomerId);

            return (productMap, discount, membershipDiscount);
        }

        private async Task<(string type, decimal value)> GetDiscountAsync(int? promotionId) {
            if (promotionId is null) return ("NONE", 0);
            var promo = await _db.OrderPromotions.FindAsync(promotionId.Value)
                ?? throw new ArgumentException($"Promotion {promotionId.Value} does not exist.");
            return (promo.DiscountType, promo.DiscountValue);
        }

        private async Task<decimal> GetMembershipDiscountAsync(int customerId) {
            var customer = await _db.Customers
                .Include(c => c.Tier)
                .FirstOrDefaultAsync(c => c.Id == customerId);
            return customer?.Tier?.DiscountPercent ?? 0;
        }

        private static Order BuildOrder(
            CreatePosOrderCommand command,
            Dictionary<int, (string name, string sku, decimal price)> productMap,
            (string type, decimal value) discount,
            decimal membershipDiscountPercent) {

            var items = command.Items.Select(i => {
                var (name, sku, price) = productMap[i.ProductId];
                return new OrderItem {
                    ProductId   = i.ProductId,
                    ProductName = name,
                    Sku         = sku,
                    UnitPrice   = price,
                    Quantity    = i.Quantity,
                    LineTotal   = i.IsGift == 1 ? 0 : price * i.Quantity,
                    IsGift      = i.IsGift
                };
            }).ToList();

            var subtotal = items.Sum(i => i.LineTotal);

            // Apply promotion discount first
            var afterPromo = discount.type switch {
                "PERCENTAGE" => subtotal * (1 - discount.value / 100),
                "FIXED"      => Math.Max(0, subtotal - discount.value),
                _            => subtotal
            };

            // Then apply membership tier discount on top
            var totalAmount = membershipDiscountPercent > 0
                ? afterPromo * (1 - membershipDiscountPercent / 100)
                : afterPromo;

            var roundedTotal = Math.Round(totalAmount, 2);
            var paymentsTotal = command.Payments.Sum(p => p.Amount);
            if (paymentsTotal < 0)
                throw new ArgumentException("Total payments amount cannot be negative.");

            var payments = BuildPaymentTransactions(command.Payments, roundedTotal);
            var primaryPaymentMethod = command.Payments.FirstOrDefault()?.PaymentMethod?.Trim() ?? "CASH";

            return new Order {
                OrderCode           = GenerateOrderCode(),
                StoreId             = command.StoreId,
                CustomerId          = command.CustomerId,
                CashierId           = command.CashierId,
                PromotionId         = command.PromotionId,
                PaymentMethod       = primaryPaymentMethod,
                TotalAmount         = roundedTotal,
                PaymentStatus       = "unpaid",
                StockStatus         = "pending_deduct",
                OrderStatus         = "confirmed",
                CreatedAt           = DateTime.UtcNow,
                OrderItems          = items,
                PaymentTransactions = payments
            };
        }

        private async Task DeductInventoryAsync(Order order, int warehouseId, int cashierId) {
            var productIds = order.OrderItems
                .Where(i => i.IsGift == 0)
                .Select(i => i.ProductId)
                .Distinct()
                .ToList();

            var bomHeaders = await _db.BomHeaders
                .Include(b => b.BomLines)
                .Where(b => productIds.Contains(b.FinishedGoodId))
                .ToDictionaryAsync(b => b.FinishedGoodId);

            // Build materialId -> qty to deduct
            var deductMap = new Dictionary<int, decimal>();
            foreach (var item in order.OrderItems.Where(i => i.IsGift == 0)) {
                if (bomHeaders.TryGetValue(item.ProductId, out var bom) && bom.BomLines.Count > 0) {
                    var multiplier = item.Quantity / bom.QuantityOutput;
                    foreach (var line in bom.BomLines) {
                        deductMap.TryGetValue(line.MaterialId, out var existing);
                        deductMap[line.MaterialId] = existing + line.Quantity * multiplier;
                    }
                }
                else {
                    deductMap.TryGetValue(item.ProductId, out var existing);
                    deductMap[item.ProductId] = existing + item.Quantity;
                }
            }

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

        private async Task UpdateCustomerSpendAsync(int customerId, decimal amount) {
            var customer = await _db.Customers
                .FirstOrDefaultAsync(c => c.Id == customerId);
            if (customer is null) return;

            customer.TotalSpend += amount;

            // Auto-upgrade to highest qualifying tier
            var bestTier = await _db.MembershipTiers
                .Where(t => t.MinTotalSpend <= customer.TotalSpend)
                .OrderByDescending(t => t.MinTotalSpend)
                .FirstOrDefaultAsync();

            if (bestTier is not null && customer.TierId != bestTier.Id)
                customer.TierId = bestTier.Id;
        }

        private async Task WriteAuditLogAsync(string action, string entityType, int entityId,
                                               int? userId, int? storeId) {
            _db.AuditLogs.Add(new AuditLog {
                Action     = action,
                EntityType = entityType,
                EntityId   = entityId,
                UserId     = userId,
                StoreId    = storeId,
                Status     = "SUCCESS",
                CreatedAt  = DateTime.UtcNow
            });
            await Task.CompletedTask; // SaveChanges called by caller
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
                if (bom is not null && bom.BomLines.Count > 0) {
                    var multiplier = item.Quantity / bom.QuantityOutput;
                    foreach (var line in bom.BomLines) {
                        snapshot.Add(new BomSnapshotEntry {
                            ProductId  = item.ProductId,
                            MaterialId = line.MaterialId,
                            Quantity   = line.Quantity * multiplier
                        });
                    }
                }
                else {
                    snapshot.Add(new BomSnapshotEntry {
                        ProductId  = item.ProductId,
                        MaterialId = item.ProductId,
                        Quantity   = item.Quantity
                    });
                }
            }
            return snapshot;
        }

        private static string GenerateOrderCode() {
            var ts     = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
            var suffix = Guid.NewGuid().ToString("N")[..6].ToUpper();
            return $"POS-{ts}-{suffix}";
        }

        private static bool HasTransferPayment(CreatePosOrderCommand command) {
            return command.Payments.Any(p =>
                string.Equals(p.PaymentMethod, "TRANSFER", StringComparison.OrdinalIgnoreCase));
        }

        private static bool IsFullCashPayment(CreatePosOrderCommand command, decimal orderTotal) {
            if (orderTotal <= 0 || HasTransferPayment(command)) {
                return false;
            }

            var cashPaid = command.Payments
                .Where(p => string.Equals(p.PaymentMethod, "CASH", StringComparison.OrdinalIgnoreCase))
                .Sum(p => p.Amount);

            return cashPaid >= orderTotal;
        }

        private string ApplyPaidState(Order order, int cashierId, string paymentReference) {
            var confirmedAt = DateTime.UtcNow;
            order.PaymentStatus = "paid";
            order.OrderStatus = "completed";
            order.UpdatedAt = confirmedAt;

            foreach (var paymentTxn in order.PaymentTransactions) {
                paymentTxn.Status = "paid";
                paymentTxn.ConfirmedAt = confirmedAt;
                paymentTxn.ReferenceCode = paymentReference;
            }

            var invoice = PaymentWebhookService.CreateInvoice(order, cashierId, confirmedAt);
            _db.Invoices.Add(invoice);

            _db.AuditLogs.Add(new AuditLog {
                Action = "confirm_payment",
                EntityType = "orders",
                EntityId = order.Id,
                UserId = cashierId,
                StoreId = order.StoreId,
                Status = "SUCCESS",
                NewValues = paymentReference,
                CreatedAt = confirmedAt,
            });

            return invoice.InvoiceCode;
        }

        private static List<PaymentTransaction> BuildPaymentTransactions(
            List<PaymentCommand> paymentCommands,
            decimal orderTotal) {
            var remaining = orderTotal;
            var payments = new List<PaymentTransaction>();

            foreach (var payment in paymentCommands) {
                if (remaining <= 0) {
                    break;
                }

                var amount = Math.Min(Math.Max(0, payment.Amount), remaining);
                if (amount <= 0) {
                    continue;
                }

                remaining -= amount;
                payments.Add(new PaymentTransaction {
                    PaymentMethod   = payment.PaymentMethod,
                    Amount          = amount,
                    Status          = "pending",
                    TransactionDate = DateTime.UtcNow
                });
            }

            if (payments.Count == 0 && orderTotal > 0) {
                throw new ArgumentException(
                    $"Total payments amount ({paymentCommands.Sum(p => p.Amount)}) must be greater than 0 for order total ({orderTotal}).");
            }

            return payments;
        }

        private static PosOrderResult ToResult(Order order) => new() {
            OrderId       = order.Id,
            OrderCode     = order.OrderCode,
            TotalAmount   = order.TotalAmount,
            PaymentStatus = order.PaymentStatus,
            StockStatus   = order.StockStatus,
            OrderStatus   = order.OrderStatus,
            CreatedAt     = order.CreatedAt,
            Items         = order.OrderItems.Select(i => new PosOrderItemResult {
                ProductId   = i.ProductId,
                ProductName = i.ProductName,
                Sku         = i.Sku,
                UnitPrice   = i.UnitPrice,
                Quantity    = i.Quantity,
                LineTotal   = i.LineTotal,
                IsGift      = i.IsGift
            }).ToList()
        };

        private class BomSnapshotEntry {
            public int     ProductId  { get; set; }
            public int     MaterialId { get; set; }
            public decimal Quantity   { get; set; }
        }
    }
}
