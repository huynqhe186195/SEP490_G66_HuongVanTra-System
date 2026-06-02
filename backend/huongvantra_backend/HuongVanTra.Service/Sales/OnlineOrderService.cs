using HuongVanTra.Core.Entities.Sales;
using HuongVanTra.Core.Entities.System;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Sales.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace HuongVanTra.Service.Sales {
    public class OnlineOrderService : IOnlineOrderService {
        private readonly AppDbContext _db;

        public OnlineOrderService(AppDbContext db) {
            _db = db;
        }

        public async Task<OnlineOrderResult> CreateVietQrOrderAsync(CreateOnlineOrderCommand command) {
            var (productMap, discount, membershipDiscount) = await ValidateAndLoadAsync(command);

            await using var tx = await _db.Database.BeginTransactionAsync();
            try {
                var order = BuildOrder(command, productMap, discount, membershipDiscount);
                order.PaymentMethod = "VIETQR";
                order.PaymentStatus = "pending_payment";
                order.StockStatus   = "pending_deduct";
                order.OrderStatus   = "confirmed";

                // OrderCode chưa có ở đây — sẽ set sau SaveChanges; lưu tạm để gán cho PaymentTransaction sau
                _db.Orders.Add(order);
                await _db.SaveChangesAsync();

                // Tạo PaymentTransaction pending, reference = order_code
                _db.PaymentTransactions.Add(new PaymentTransaction {
                    OrderId         = order.Id,
                    PaymentMethod   = "VIETQR",
                    Amount          = order.TotalAmount,
                    Status          = "pending",
                    ReferenceCode   = order.OrderCode,
                    TransactionDate = DateTime.UtcNow
                });

                await CreateStockDeductQueueAsync(command, order.Id);
                await UpdateCustomerSpendAsync(command.CustomerId, order.TotalAmount);
                await WriteAuditLogAsync("create", "orders", order.Id, command.CashierId, command.StoreId);

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                var qrPayload = VietQrHelper.GenerateQrPayload(order.OrderCode, order.TotalAmount);
                return ToResult(order, qrPayload);
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        public async Task<OnlineOrderResult> CreateCodOrderAsync(CreateOnlineOrderCommand command) {
            var (productMap, discount, membershipDiscount) = await ValidateAndLoadAsync(command);

            await using var tx = await _db.Database.BeginTransactionAsync();
            try {
                var order = BuildOrder(command, productMap, discount, membershipDiscount);
                order.PaymentMethod = "COD";
                order.PaymentStatus = "unpaid";
                order.StockStatus   = "pending_deduct";
                order.OrderStatus   = "confirmed";

                _db.Orders.Add(order);
                await _db.SaveChangesAsync();

                // Tạo PaymentTransaction unpaid cho COD
                _db.PaymentTransactions.Add(new PaymentTransaction {
                    OrderId         = order.Id,
                    PaymentMethod   = "COD",
                    Amount          = order.TotalAmount,
                    Status          = "unpaid",
                    TransactionDate = DateTime.UtcNow
                });

                await CreateStockDeductQueueAsync(command, order.Id);
                await UpdateCustomerSpendAsync(command.CustomerId, order.TotalAmount);
                await WriteAuditLogAsync("create", "orders", order.Id, command.CashierId, command.StoreId);

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                return ToResult(order, null);
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        // ── helpers ─────────────────────────────────────────────────────────

        private async Task<(Dictionary<int, (string Name, string Sku, decimal Price)> productMap,
                            (string type, decimal value) discount,
                            decimal membershipDiscount)>
            ValidateAndLoadAsync(CreateOnlineOrderCommand command) {

            if (command.Items.Count == 0)
                throw new ArgumentException("Order must have at least one item.");

            var storeExists = await _db.Stores.AnyAsync(s => s.Id == command.StoreId);
            if (!storeExists)
                throw new ArgumentException($"Store {command.StoreId} does not exist.");

            if (command.CustomerId.HasValue) {
                var customerExists = await _db.Customers.AnyAsync(c => c.Id == command.CustomerId.Value);
                if (!customerExists)
                    throw new ArgumentException($"Customer {command.CustomerId.Value} does not exist.");
            }

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

        private async Task<decimal> GetMembershipDiscountAsync(int? customerId) {
            if (customerId is null) return 0;
            var customer = await _db.Customers
                .Include(c => c.Tier)
                .FirstOrDefaultAsync(c => c.Id == customerId.Value);
            return customer?.Tier?.DiscountPercent ?? 0;
        }

        private static Order BuildOrder(
            CreateOnlineOrderCommand command,
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
            var afterPromo = discount.type switch {
                "PERCENTAGE" => subtotal * (1 - discount.value / 100),
                "FIXED"      => Math.Max(0, subtotal - discount.value),
                _            => subtotal
            };
            var totalAmount = membershipDiscountPercent > 0
                ? afterPromo * (1 - membershipDiscountPercent / 100)
                : afterPromo;

            return new Order {
                OrderCode           = GenerateOrderCode(),
                StoreId             = command.StoreId,
                CustomerId          = command.CustomerId,
                CashierId           = command.CashierId,
                PromotionId         = command.PromotionId,
                TotalAmount         = Math.Round(totalAmount, 2),
                PaymentMethod       = command.PaymentMethod,
                PaymentStatus       = "unpaid",
                StockStatus         = "pending_deduct",
                OrderStatus         = "confirmed",
                ShippingAddress     = command.ShippingAddress,
                CreatedAt           = DateTime.UtcNow,
                OrderItems          = items
            };
        }

        private async Task CreateStockDeductQueueAsync(CreateOnlineOrderCommand command, int orderId) {
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
                    foreach (var line in bom.BomLines)
                        snapshot.Add(new BomSnapshotEntry {
                            ProductId  = item.ProductId,
                            MaterialId = line.MaterialId,
                            Quantity   = line.Quantity * multiplier
                        });
                }
                else {
                    snapshot.Add(new BomSnapshotEntry {
                        ProductId  = item.ProductId,
                        MaterialId = item.ProductId,
                        Quantity   = item.Quantity
                    });
                }
            }

            _db.StockDeductQueues.Add(new StockDeductQueue {
                OrderId     = orderId,
                Status      = "waiting",
                BomSnapshot = JsonSerializer.Serialize(snapshot),
                CreatedAt   = DateTime.UtcNow
            });
        }

        private async Task UpdateCustomerSpendAsync(int? customerId, decimal amount) {
            if (customerId is null) return;
            var customer = await _db.Customers
                .FirstOrDefaultAsync(c => c.Id == customerId.Value);
            if (customer is null) return;

            customer.TotalSpend += amount;

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
            await Task.CompletedTask;
        }

        public async Task<CodDeliveredResult> MarkCodDeliveredAndPaidAsync(int orderId, int employeeId) {
            var order = await _db.Orders
                .Include(o => o.PaymentTransactions)
                .FirstOrDefaultAsync(o => o.Id == orderId)
                ?? throw new ArgumentException($"Order {orderId} does not exist.");

            if (order.PaymentMethod != "COD")
                throw new InvalidOperationException($"Order {orderId} is not a COD order.");

            if (order.PaymentStatus == "paid")
                throw new InvalidOperationException($"Order {orderId} has already been marked as paid.");

            if (order.OrderStatus == "cancelled")
                throw new InvalidOperationException($"Order {orderId} is cancelled and cannot be updated.");

            await using var tx = await _db.Database.BeginTransactionAsync();
            try {
                var confirmedAt = DateTime.UtcNow;
                order.PaymentStatus = "paid";
                order.OrderStatus   = "completed";

                // Cập nhật PaymentTransaction
                var paymentTxn = order.PaymentTransactions.FirstOrDefault();
                if (paymentTxn is not null) {
                    paymentTxn.Status = "paid";
                    paymentTxn.ConfirmedById = employeeId;
                    paymentTxn.ConfirmedAt = confirmedAt;
                }

                _db.AuditLogs.Add(new AuditLog {
                    Action     = "cod_delivered_paid",
                    EntityType = "orders",
                    EntityId   = order.Id,
                    UserId     = employeeId,
                    StoreId    = order.StoreId,
                    Status     = "SUCCESS",
                    CreatedAt  = confirmedAt
                });

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                return new CodDeliveredResult {
                    OrderId       = order.Id,
                    OrderCode     = order.OrderCode,
                    PaymentStatus = order.PaymentStatus,
                    OrderStatus   = order.OrderStatus,
                    ConfirmedAt   = confirmedAt
                };
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        public async Task<CodRemindedResult> MarkCodRemindedAsync(int orderId, int employeeId) {
            var order = await _db.Orders
                .FirstOrDefaultAsync(o => o.Id == orderId)
                ?? throw new ArgumentException($"Order {orderId} does not exist.");

            if (order.PaymentMethod != "COD")
                throw new InvalidOperationException($"Order {orderId} is not a COD order.");

            if (order.PaymentStatus == "paid")
                throw new InvalidOperationException($"Order {orderId} has already been paid.");

            if (order.OrderStatus == "cancelled")
                throw new InvalidOperationException($"Order {orderId} is cancelled and cannot be reminded.");

            await using var tx = await _db.Database.BeginTransactionAsync();
            try {
                var remindedAt = DateTime.UtcNow;
                order.LastRemindedAt = remindedAt;

                _db.AuditLogs.Add(new AuditLog {
                    Action     = "cod_mark_reminded",
                    EntityType = "orders",
                    EntityId   = order.Id,
                    UserId     = employeeId,
                    StoreId    = order.StoreId,
                    Status     = "SUCCESS",
                    CreatedAt  = remindedAt
                });

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                return new CodRemindedResult {
                    OrderId = order.Id,
                    OrderCode = order.OrderCode,
                    RemindedAt = remindedAt
                };
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        public async Task<List<OverdueCodOrderResult>> GetOverdueCodOrdersAsync() {
            var cutoff = DateTime.UtcNow.AddDays(-7);

            // Đơn COD treo: là COD, chưa paid, chưa cancelled, và đã quá 7 ngày
            // kể từ ngày tạo hoặc từ lần nhắc gần nhất
            var orders = await _db.Orders
                .Where(o => o.PaymentMethod == "COD"
                         && o.PaymentStatus != "paid"
                         && o.OrderStatus   != "cancelled"
                         && (o.LastRemindedAt == null
                                ? o.CreatedAt <= cutoff
                                : o.LastRemindedAt <= cutoff))
                .OrderBy(o => o.CreatedAt)
                .ToListAsync();

            var now = DateTime.UtcNow;
            return orders.Select(o => new OverdueCodOrderResult {
                OrderId        = o.Id,
                OrderCode      = o.OrderCode,
                TotalAmount    = o.TotalAmount,
                PaymentStatus  = o.PaymentStatus,
                OrderStatus    = o.OrderStatus,
                CreatedAt      = o.CreatedAt,
                LastRemindedAt = o.LastRemindedAt,
                DaysPending    = (int)(now - (o.LastRemindedAt ?? o.CreatedAt)).TotalDays
            }).ToList();
        }

        public async Task<VietQrPaidResult> MarkVietQrPaidAsync(int orderId, int employeeId) {
            var order = await _db.Orders
                .Include(o => o.PaymentTransactions)
                .FirstOrDefaultAsync(o => o.Id == orderId)
                ?? throw new ArgumentException($"Order {orderId} does not exist.");

            if (order.PaymentMethod != "VIETQR")
                throw new InvalidOperationException($"Order {orderId} is not a VIETQR order.");

            if (order.PaymentStatus == "paid")
                throw new InvalidOperationException($"Order {orderId} has already been marked as paid.");

            if (order.OrderStatus == "cancelled")
                throw new InvalidOperationException($"Order {orderId} is cancelled and cannot be updated.");

            await using var tx = await _db.Database.BeginTransactionAsync();
            try {
                var confirmedAt = DateTime.UtcNow;
                order.PaymentStatus = "paid";

                var paymentTxn = order.PaymentTransactions.FirstOrDefault();
                if (paymentTxn is not null) {
                    paymentTxn.Status = "paid";
                    paymentTxn.ConfirmedById = employeeId;
                    paymentTxn.ConfirmedAt = confirmedAt;
                }

                _db.AuditLogs.Add(new AuditLog {
                    Action     = "vietqr_mark_paid",
                    EntityType = "orders",
                    EntityId   = order.Id,
                    UserId     = employeeId,
                    StoreId    = order.StoreId,
                    Status     = "SUCCESS",
                    CreatedAt  = confirmedAt
                });

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                return new VietQrPaidResult {
                    OrderId       = order.Id,
                    OrderCode     = order.OrderCode,
                    PaymentStatus = order.PaymentStatus,
                    ConfirmedAt   = confirmedAt
                };
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        private static string GenerateOrderCode() {
            var ts     = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
            var suffix = Guid.NewGuid().ToString("N")[..6].ToUpper();
            return $"ONL-{ts}-{suffix}";
        }

        private static OnlineOrderResult ToResult(Order order, string? qrPayload) => new() {
            OrderId       = order.Id,
            OrderCode     = order.OrderCode,
            TotalAmount   = order.TotalAmount,
            PaymentMethod = order.PaymentMethod,
            PaymentStatus = order.PaymentStatus,
            StockStatus   = order.StockStatus,
            OrderStatus   = order.OrderStatus,
            QrPayload     = qrPayload,
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
