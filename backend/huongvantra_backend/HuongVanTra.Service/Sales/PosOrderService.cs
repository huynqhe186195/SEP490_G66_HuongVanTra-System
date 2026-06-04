using HuongVanTra.Core.Entities.Customers;
using HuongVanTra.Core.Entities.Sales;
using HuongVanTra.Core.Entities.System;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Customers;
using HuongVanTra.Service.Sales.Models;
using HuongVanTra.Service.Common;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace HuongVanTra.Service.Sales {
    public class PosOrderService : IPosOrderService {
        private readonly AppDbContext _db;
        private readonly IVietQrService _vietQrService;
        private readonly ISepayOrderVaService _sepayOrderVaService;
        private readonly SepaySettings _sepaySettings;
        private readonly ICustomerService _customerService;
        private readonly IStockDeductQueueService _stockDeductQueueService;

        public PosOrderService(
            AppDbContext db,
            IVietQrService vietQrService,
            ISepayOrderVaService sepayOrderVaService,
            Microsoft.Extensions.Options.IOptions<SepaySettings> sepayOptions,
            ICustomerService customerService,
            IStockDeductQueueService stockDeductQueueService) {
            _db = db;
            _vietQrService = vietQrService;
            _sepayOrderVaService = sepayOrderVaService;
            _sepaySettings = sepayOptions.Value;
            _customerService = customerService;
            _stockDeductQueueService = stockDeductQueueService;
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

                var result = ToResult(order);
                if (HasTransferPayment(command)) {
                    await ApplyTransferQrAsync(order, result);
                }

                await UpdateCustomerSpendAsync(command.CustomerId, order.TotalAmount);

                // VietQR/chuyển khoản tại quầy: chờ thanh toán → cộng công nợ
                if (command.CustomerId > 0) {
                    await _customerService.UpdateCustomerDebtAsync(command.CustomerId, order.TotalAmount, _db);
                }

                await WriteAuditLogAsync("create", "orders", order.Id, command.CashierId, command.StoreId);

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                return result;
            }
            catch {
                await tx.RollbackAsync();
                throw;
            }
        }

        public async Task<PosOrderResult> CreateOfflineOrderAsync(CreatePosOrderCommand command) {
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

                string? invoiceCode = null;
                var isPaid = IsFullCashPayment(command, order.TotalAmount);
                if (isPaid) {
                    invoiceCode = ApplyPaidState(order, command.CashierId, $"POS-CASH-{order.OrderCode}");
                }
                else if (command.CustomerId > 0) {
                    var cashPaid = command.Payments
                        .Where(p => string.Equals(p.PaymentMethod, "CASH", StringComparison.OrdinalIgnoreCase))
                        .Sum(p => p.Amount);
                    var remaining = Math.Max(0, order.TotalAmount - cashPaid);
                    if (remaining > 0) {
                        await _customerService.UpdateCustomerDebtAsync(command.CustomerId, remaining, _db);
                    }
                }

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                if (isPaid) {
                    await _stockDeductQueueService.TryAutoDeductForOrderAsync(order.Id, command.CashierId);
                }

                var refreshed = await _db.Orders
                    .AsNoTracking()
                    .FirstAsync(o => o.Id == order.Id);

                var result = ToResult(refreshed);
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
            if (command.ManualDiscount < 0)
                throw new ArgumentException("Manual discount cannot be negative.");

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
            PromotionValidity.EnsureUsable(promo);
            return (promo.DiscountType, promo.DiscountValue);
        }

        private async Task<decimal> GetMembershipDiscountAsync(int customerId) {
            var customer = await _db.Customers
                .Include(c => c.Tier)
                .FirstOrDefaultAsync(c => c.Id == customerId);
            if (customer is null || !CustomerTypeRules.SupportsMembershipTier(customer.CustomerType)) {
                return 0;
            }

            return customer.Tier?.DiscountPercent ?? 0;
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

            var roundedTotal = Math.Round(totalAmount, 2);
            var roundedSubtotal = Math.Round(subtotal, 2);
            var roundedManualDiscount = Math.Round(manualDiscount, 2);
            var roundedCouponDiscount = Math.Round(couponDiscount, 2);

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
                SubTotal            = roundedSubtotal,
                ManualDiscount      = roundedManualDiscount,
                CouponDiscount      = roundedCouponDiscount,
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

        private async Task UpdateCustomerSpendAsync(int customerId, decimal amount) {
            var customer = await _db.Customers
                .FirstOrDefaultAsync(c => c.Id == customerId);
            if (customer is null) return;

            customer.TotalSpend += amount;

            if (!CustomerTypeRules.SupportsMembershipTier(customer.CustomerType)) {
                return;
            }

            // Auto-upgrade to highest qualifying tier (chỉ khách phổ thông)
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

        private async Task ApplyTransferQrAsync(Order order, PosOrderResult result) {
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

        private static bool HasTransferPayment(CreatePosOrderCommand command) {
            return command.Payments.Any(p =>
                string.Equals(p.PaymentMethod, "TRANSFER", StringComparison.OrdinalIgnoreCase));
        }

        private static bool IsFullCashPayment(CreatePosOrderCommand command, decimal orderTotal) {
            if (HasTransferPayment(command)) {
                return false;
            }

            var hasCashPayment = command.Payments.Any(p =>
                string.Equals(p.PaymentMethod, "CASH", StringComparison.OrdinalIgnoreCase));

            if (orderTotal <= 0) {
                return hasCashPayment;
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
                NewValues = AuditLogJson.Serialize(new { paymentReference }),
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

            // Cho phép ghi nợ / chưa thu tiền: không có dòng thanh toán khi tổng đơn > 0.
            if (payments.Count == 0 && orderTotal > 0) {
                return payments;
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
