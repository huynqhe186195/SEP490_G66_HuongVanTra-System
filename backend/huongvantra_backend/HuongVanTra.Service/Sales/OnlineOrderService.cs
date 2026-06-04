using HuongVanTra.Core.Constants;
using HuongVanTra.Core.Entities.Customers;
using HuongVanTra.Core.Entities.Inventory;
using HuongVanTra.Core.Entities.Sales;
using HuongVanTra.Core.Entities.System;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Customers;
using HuongVanTra.Service.Sales.Models;
using HuongVanTra.Service.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace HuongVanTra.Service.Sales {
    public class OnlineOrderService : IOnlineOrderService {
        private readonly AppDbContext _db;
        private readonly IOrderConfirmationService _orderConfirmationService;
        private readonly IVietQrService _vietQrService;
        private readonly ISepayOrderVaService _sepayOrderVaService;
        private readonly SepaySettings _sepaySettings;
        private readonly ICustomerService _customerService;
        private readonly IStockDeductQueueService _stockDeductQueueService;

        public OnlineOrderService(
            AppDbContext db,
            IOrderConfirmationService orderConfirmationService,
            IVietQrService vietQrService,
            ISepayOrderVaService sepayOrderVaService,
            IOptions<SepaySettings> sepayOptions,
            ICustomerService customerService,
            IStockDeductQueueService stockDeductQueueService) {
            _db = db;
            _orderConfirmationService = orderConfirmationService;
            _vietQrService = vietQrService;
            _sepayOrderVaService = sepayOrderVaService;
            _sepaySettings = sepayOptions.Value;
            _customerService = customerService;
            _stockDeductQueueService = stockDeductQueueService;
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

                // Tạo công nợ cho VietQR order vì PaymentStatus = pending_payment
                if (command.CustomerId.HasValue) {
                    await _customerService.UpdateCustomerDebtAsync(command.CustomerId.Value, order.TotalAmount, _db);
                }

                await WriteAuditLogAsync("create", "orders", order.Id, command.CashierId, command.StoreId);

                var result = ToResult(order);
                await ApplyTransferQrAsync(order, result);

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                return result;
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

                // Tạo công nợ cho COD order vì PaymentStatus = unpaid
                if (command.CustomerId.HasValue) {
                    await _customerService.UpdateCustomerDebtAsync(command.CustomerId.Value, order.TotalAmount, _db);
                }

                await WriteAuditLogAsync("create", "orders", order.Id, command.CashierId, command.StoreId);

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                return ToResult(order);
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

            if (command.ManualDiscount < 0)
                throw new ArgumentException("Manual discount cannot be negative.");

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
            PromotionValidity.EnsureUsable(promo);
            return (promo.DiscountType, promo.DiscountValue);
        }

        private async Task<decimal> GetMembershipDiscountAsync(int? customerId) {
            if (customerId is null) return 0;
            var customer = await _db.Customers
                .Include(c => c.Tier)
                .FirstOrDefaultAsync(c => c.Id == customerId.Value);
            if (customer is null || !CustomerTypeRules.SupportsMembershipTier(customer.CustomerType)) {
                return 0;
            }

            return customer.Tier?.DiscountPercent ?? 0;
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
            if (command.ManualDiscount > subtotal)
                throw new ArgumentException("Manual discount cannot exceed order subtotal.");
            var manualDiscount = Math.Min(Math.Max(0, command.ManualDiscount), subtotal);
            var afterManual = subtotal - manualDiscount;

            var couponDiscount = discount.type switch {
                "PERCENTAGE" => afterManual * (discount.value / 100),
                "FIXED"      => Math.Min(discount.value, afterManual),
                _            => 0m
            };

            var afterPromo = discount.type switch {
                "PERCENTAGE" => afterManual * (1 - discount.value / 100),
                "FIXED"      => Math.Max(0, afterManual - discount.value),
                _            => afterManual
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
                SubTotal            = Math.Round(subtotal, 2),
                ManualDiscount      = Math.Round(manualDiscount, 2),
                CouponDiscount      = Math.Round(couponDiscount, 2),
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
            var snapshot = await BuildBomSnapshotAsync(command);

            _db.StockDeductQueues.Add(new StockDeductQueue {
                OrderId     = orderId,
                Status      = QueueStatus.Waiting,
                BomSnapshot = JsonSerializer.Serialize(snapshot),
                CreatedAt   = DateTime.UtcNow
            });
        }

        private async Task<List<BomSnapshotEntry>> BuildBomSnapshotAsync(CreateOnlineOrderCommand command) {
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

            if (snapshot.Count == 0) {
                throw new InvalidOperationException("No inventory items to deduct for this order.");
            }

            return snapshot;
        }

        public async Task<CodRejectedResult> MarkCodRejectedAsync(int orderId, int employeeId, string? reason) {
            var order = await _db.Orders
                .Include(o => o.OrderItems)
                .Include(o => o.StockDeductQueue)
                .FirstOrDefaultAsync(o => o.Id == orderId)
                ?? throw new ArgumentException($"Order {orderId} does not exist.");

            if (order.PaymentMethod != "COD")
                throw new InvalidOperationException($"Order {orderId} is not a COD order.");

            if (order.OrderStatus == "cancelled")
                throw new InvalidOperationException($"Order {orderId} is already cancelled.");

            if (order.PaymentStatus == "paid")
                throw new InvalidOperationException($"Order {orderId} has already been paid and cannot be rejected.");

            var queue = order.StockDeductQueue;
            var stockReversed = false;

            await using var tx = await _db.Database.BeginTransactionAsync();
            try {
                var cancelledAt = DateTime.UtcNow;

                if (queue is not null && queue.Status == QueueStatus.Confirmed) {
                    var warehouse = await _db.Warehouses
                        .FirstOrDefaultAsync(w => w.StoreId == order.StoreId)
                        ?? throw new InvalidOperationException($"No warehouse found for store {order.StoreId}.");

                    await ReverseInventoryAsync(order, queue, warehouse.Id, employeeId);
                    stockReversed = true;
                }

                if (queue is not null && queue.Status != QueueStatus.Cancelled)
                    queue.Status = QueueStatus.Cancelled;

                order.OrderStatus  = "cancelled";
                order.StockStatus  = "cancelled";
                order.UpdatedAt    = cancelledAt;

                // Giảm công nợ nếu đơn chưa thanh toán
                if (order.CustomerId.HasValue &&
                    (order.PaymentStatus == "unpaid" || order.PaymentStatus == "pending_payment")) {
                    await _customerService.UpdateCustomerDebtAsync(order.CustomerId.Value, -order.TotalAmount, _db);
                }

                _db.AuditLogs.Add(new AuditLog {
                    Action     = "cod_rejected",
                    EntityType = "orders",
                    EntityId   = order.Id,
                    UserId     = employeeId,
                    StoreId    = order.StoreId,
                    Status     = "SUCCESS",
                    NewValues  = AuditLogJson.Serialize(new { reason }),
                    CreatedAt  = cancelledAt
                });

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                return new CodRejectedResult {
                    OrderId       = order.Id,
                    OrderCode     = order.OrderCode,
                    OrderStatus   = order.OrderStatus,
                    StockStatus   = order.StockStatus,
                    StockReversed = stockReversed,
                    Reason        = reason,
                    CancelledAt   = cancelledAt
                };
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        private async Task ReverseInventoryAsync(Order order, StockDeductQueue queue, int warehouseId, int employeeId) {
            var snapshot = JsonSerializer.Deserialize<List<BomSnapshotEntry>>(queue.BomSnapshot) ?? new();

            var deductMap = snapshot
                .GroupBy(e => e.MaterialId)
                .ToDictionary(g => g.Key, g => g.Sum(e => e.Quantity));

            if (deductMap.Count == 0) return;

            var materialIds = deductMap.Keys.ToList();
            var balances = await _db.InventoryBalances
                .Where(b => b.WarehouseId == warehouseId && materialIds.Contains(b.ProductId))
                .ToDictionaryAsync(b => b.ProductId);

            var txnCode = $"REV-{order.OrderCode}";
            foreach (var (materialId, qty) in deductMap) {
                if (!balances.TryGetValue(materialId, out var balance)) {
                    balance = new HuongVanTra.Core.Entities.Inventory.InventoryBalance {
                        WarehouseId = warehouseId,
                        ProductId   = materialId,
                        Quantity    = 0
                    };
                    _db.InventoryBalances.Add(balance);
                    await _db.SaveChangesAsync();
                    balances[materialId] = balance;
                }

                var before = balance.Quantity;
                var after  = before + qty;
                balance.Quantity = after;

                _db.InventoryTransactions.Add(new HuongVanTra.Core.Entities.Inventory.InventoryTransaction {
                    TxnCode        = $"{txnCode}-{materialId}",
                    WarehouseId    = warehouseId,
                    ProductId      = materialId,
                    TxnType        = "IN",
                    Quantity       = qty,
                    QuantityBefore = before,
                    QuantityAfter  = after,
                    RefType        = "ORDER_CANCEL",
                    RefId          = order.Id,
                    CreatedById    = employeeId,
                    CreatedAt      = DateTime.UtcNow
                });
            }
        }

        private async Task UpdateCustomerSpendAsync(int? customerId, decimal amount) {
            if (customerId is null) return;
            var customer = await _db.Customers
                .FirstOrDefaultAsync(c => c.Id == customerId.Value);
            if (customer is null) return;

            customer.TotalSpend += amount;

            var bestTier = await _db.MembershipTiers
                .Where(t => t.IsActive && t.MinTotalSpend <= customer.TotalSpend)
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
            var result = await _orderConfirmationService.ConfirmCodCompletedAsync(orderId, employeeId);
            return new CodDeliveredResult {
                OrderId = result.OrderId,
                OrderCode = result.OrderCode,
                PaymentStatus = result.PaymentStatus,
                OrderStatus = result.OrderStatus,
                ConfirmedAt = result.ConfirmedAt,
            };
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
                    Action = "cod_mark_reminded",
                    EntityType = "orders",
                    EntityId = order.Id,
                    UserId = employeeId,
                    StoreId = order.StoreId,
                    Status = "SUCCESS",
                    CreatedAt = remindedAt
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

        public async Task<List<OverdueCodOrderResult>> GetOverdueCodOrdersAsync(int? storeId = null) {
            var cutoff = DateTime.UtcNow.AddDays(-7);

            // Đơn COD treo: là COD, chưa paid, chưa cancelled, và đã quá 7 ngày
            // kể từ ngày tạo hoặc từ lần nhắc gần nhất
            var ordersQuery = _db.Orders.AsQueryable();

            if (storeId.HasValue) {
                ordersQuery = ordersQuery.Where(o => o.StoreId == storeId.Value);
            }

            var orders = await ordersQuery
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
                order.UpdatedAt = confirmedAt;

                var paymentTxn = order.PaymentTransactions.FirstOrDefault();
                if (paymentTxn is not null) {
                    paymentTxn.Status = "paid";
                    paymentTxn.ConfirmedById = employeeId;
                    paymentTxn.ConfirmedAt = confirmedAt;
                }

                var invoice = PaymentWebhookService.CreateInvoice(order, employeeId, confirmedAt);
                _db.Invoices.Add(invoice);

                // Giảm công nợ khi VietQR được đánh dấu đã thanh toán
                if (order.CustomerId.HasValue) {
                    await _customerService.UpdateCustomerDebtAsync(order.CustomerId.Value, -order.TotalAmount, _db);
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

                await _stockDeductQueueService.TryAutoDeductForOrderAsync(order.Id, employeeId);

                return new VietQrPaidResult {
                    OrderId       = order.Id,
                    OrderCode     = order.OrderCode,
                    PaymentStatus = order.PaymentStatus,
                    InvoiceCode   = invoice.InvoiceCode,
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

        private async Task ApplyTransferQrAsync(Order order, OnlineOrderResult result) {
            var posDuration = _sepaySettings.PosVaDurationSeconds > 0 ? _sepaySettings.PosVaDurationSeconds : 300;
            var sepayVa = await _sepayOrderVaService.CreateOrderVaForTransferAsync(
                order.OrderCode,
                order.TotalAmount,
                posDuration);

            order.Notes = SepayOrderNotes.Build(sepayVa.VaNumber, order.TotalAmount, sepayVa.SepayOrderId, posDuration);
            result.TransferAccountNumber = sepayVa.VaNumber;
            result.PaymentMode = sepayVa.PaymentMode;
            result.QrExpiresAtUtc = sepayVa.ExpiresAtUtc;

            if (!string.IsNullOrWhiteSpace(sepayVa.QrImageUrl)) {
                result.QrImageUrl = sepayVa.QrImageUrl;
                result.QrPayload = sepayVa.QrPayload;
                result.TransferContent = order.OrderCode;
                return;
            }

            var qr = _vietQrService.GenerateForAccount(
                sepayVa.VaNumber,
                order.OrderCode,
                order.TotalAmount);
            result.QrImageUrl = qr.QrImageUrl;
            result.QrPayload = qr.QrPayload;
            result.TransferContent = qr.TransferContent;
        }

        private static OnlineOrderResult ToResult(Order order) => new() {
            OrderId       = order.Id,
            OrderCode     = order.OrderCode,
            TotalAmount   = order.TotalAmount,
            PaymentMethod = order.PaymentMethod,
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
