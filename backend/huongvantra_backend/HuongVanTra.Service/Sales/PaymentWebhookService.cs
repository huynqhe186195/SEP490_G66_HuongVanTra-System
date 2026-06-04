using HuongVanTra.Core.Entities.Sales;
using HuongVanTra.Core.Entities.System;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Customers;
using HuongVanTra.Service.Sales.Models;
using HuongVanTra.Service.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HuongVanTra.Service.Sales {
    public class PaymentWebhookService : IPaymentWebhookService {
        private readonly AppDbContext _db;
        private readonly SepaySettings _settings;
        private readonly ICustomerService _customerService;
        private readonly IStockDeductQueueService _stockDeductQueueService;

        public PaymentWebhookService(
            AppDbContext db,
            IOptions<SepaySettings> options,
            ICustomerService customerService,
            IStockDeductQueueService stockDeductQueueService) {
            _db = db;
            _settings = options.Value;
            _customerService = customerService;
            _stockDeductQueueService = stockDeductQueueService;
        }

        public async Task<WebhookProcessResult> ProcessSepayWebhookAsync(
            SepayWebhookCommand command,
            CancellationToken cancellationToken = default) {

            // Chỉ xử lý giao dịch tiền vào
            if (!string.Equals(command.TransferType, "in", StringComparison.OrdinalIgnoreCase)) {
                return new WebhookProcessResult { Success = true, Skipped = true, Message = "Not an inbound transfer." };
            }

            var orderCode = TransferContentMatcher.ExtractOrderCode(
                command.Content,
                command.ReferenceCode,
                command.Code);

            Order? order = null;
            if (!string.IsNullOrWhiteSpace(orderCode)) {
                order = await FindOrderAsync(orderCode, command.Content, cancellationToken);
            }

            if (order is null) {
                order = await FindOrderBySubAccountAsync(command.SubAccount, cancellationToken);
            }

            if (order is null) {
                return new WebhookProcessResult {
                    Success = true,
                    Skipped = true,
                    Message = string.IsNullOrWhiteSpace(orderCode)
                        ? "No order code found in transfer content."
                        : $"Order {orderCode} not found.",
                };
            }

            if (_settings.ValidateAccountNumber
                && !string.IsNullOrWhiteSpace(_settings.AccountNumber)
                && !string.IsNullOrWhiteSpace(command.AccountNumber)
                && !AccountNumbersMatch(_settings.AccountNumber, command.AccountNumber)) {
                return new WebhookProcessResult {
                    Success = true,
                    Skipped = true,
                    Message = "Account number does not match configured Sepay account.",
                };
            }

            var amountDiff = Math.Abs(
                (long)Math.Round(command.TransferAmount, MidpointRounding.AwayFromZero)
                - (long)Math.Round(order.TotalAmount, MidpointRounding.AwayFromZero));
            if (amountDiff > _settings.AmountToleranceVnd) {
                return new WebhookProcessResult {
                    Success = true,
                    Skipped = true,
                    Message = $"Amount mismatch: expected {order.TotalAmount}, received {command.TransferAmount}.",
                    OrderId = order.Id,
                    OrderCode = order.OrderCode,
                };
            }

            // Idempotency: đã paid rồi thì bỏ qua, không xử lý lại
            if (string.Equals(order.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase)) {
                return new WebhookProcessResult {
                    Success = true,
                    Skipped = true,
                    Message = "Order already paid.",
                    OrderId = order.Id,
                    OrderCode = order.OrderCode
                };
            }

            if (string.Equals(order.OrderStatus, "cancelled", StringComparison.OrdinalIgnoreCase)) {
                return new WebhookProcessResult { Success = true, Skipped = true, Message = "Order is cancelled." };
            }

            var wasOutstanding = order.CustomerId.HasValue
                && (string.Equals(order.PaymentStatus, "unpaid", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(order.PaymentStatus, "pending_payment", StringComparison.OrdinalIgnoreCase));

            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            try {
                var confirmedAt = DateTime.UtcNow;

                order.PaymentStatus = "paid";
                order.OrderStatus = "completed";
                order.UpdatedAt = confirmedAt;

                var paymentTxn = order.PaymentTransactions.FirstOrDefault();
                if (paymentTxn is not null) {
                    paymentTxn.Status = "paid";
                    paymentTxn.ConfirmedAt = confirmedAt;
                    paymentTxn.ReferenceCode = command.Code ?? paymentTxn.ReferenceCode;
                }

                var invoice = CreateInvoice(order, issuedById: null, confirmedAt);
                _db.Invoices.Add(invoice);

                if (wasOutstanding) {
                    await _customerService.UpdateCustomerDebtAsync(
                        order.CustomerId!.Value,
                        -order.TotalAmount,
                        _db);
                }

                _db.AuditLogs.Add(new AuditLog {
                    Action = "payment_auto_confirmed_via_webhook",
                    EntityType = "orders",
                    EntityId = order.Id,
                    StoreId = order.StoreId,
                    Status = "SUCCESS",
                    NewValues = AuditLogJson.Serialize(new {
                        sepayTxnId = command.TransactionId,
                        bankCode = command.Code,
                        amount = command.TransferAmount,
                    }),
                    CreatedAt = confirmedAt
                });

                await _db.SaveChangesAsync(cancellationToken);
                await tx.CommitAsync(cancellationToken);

                await _stockDeductQueueService.TryAutoDeductForOrderAsync(
                    order.Id,
                    order.CashierId,
                    cancellationToken);

                return new WebhookProcessResult {
                    Success = true,
                    Skipped = false,
                    Message = "Payment confirmed and invoice created.",
                    OrderId = order.Id,
                    OrderCode = order.OrderCode,
                    InvoiceCode = invoice.InvoiceCode
                };
            }
            catch {
                await tx.RollbackAsync(cancellationToken);
                throw;
            }
        }

        private async Task<Order?> FindOrderBySubAccountAsync(
            string? subAccount,
            CancellationToken cancellationToken) {
            if (string.IsNullOrWhiteSpace(subAccount)) {
                return null;
            }

            var vaDigits = SepayOrderNotes.NormalizeDigits(subAccount);
            if (vaDigits.Length == 0) {
                return null;
            }

            var marker = $"{SepayOrderNotes.VaPrefix}{vaDigits}";

            return await _db.Orders
                .Include(o => o.PaymentTransactions)
                .Where(o =>
                    o.Notes != null
                    && o.Notes.Contains(marker)
                    && (o.PaymentStatus == "pending_payment" || o.PaymentStatus == "unpaid"))
                .OrderByDescending(o => o.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        private async Task<Order?> FindOrderAsync(
            string orderCode,
            string? transferContent,
            CancellationToken cancellationToken) {
            var normalized = orderCode.Trim().ToUpperInvariant();

            var order = await _db.Orders
                .Include(o => o.PaymentTransactions)
                .FirstOrDefaultAsync(o => o.OrderCode == normalized, cancellationToken);

            if (order is not null) {
                return order;
            }

            order = await _db.Orders
                .Include(o => o.PaymentTransactions)
                .Where(o =>
                    IsAwaitingPayment(o.PaymentStatus)
                    && o.OrderCode.StartsWith(normalized))
                .OrderByDescending(o => o.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (order is not null) {
                return order;
            }

            if (string.IsNullOrWhiteSpace(transferContent)) {
                return null;
            }

            var contentKey = TransferContentMatcher.NormalizeMatchKey(transferContent);
            if (contentKey.Length == 0) {
                return null;
            }

            var pendingOrders = await _db.Orders
                .Include(o => o.PaymentTransactions)
                .Where(o => IsAwaitingPayment(o.PaymentStatus) && o.OrderCode.StartsWith("POS-"))
                .OrderByDescending(o => o.Id)
                .Take(30)
                .ToListAsync(cancellationToken);

            return pendingOrders.FirstOrDefault(o => {
                var orderKey = TransferContentMatcher.NormalizeMatchKey(o.OrderCode);
                return contentKey.Contains(orderKey, StringComparison.Ordinal)
                    || orderKey.Contains(TransferContentMatcher.NormalizeMatchKey(normalized), StringComparison.Ordinal);
            });
        }

        private static bool IsAwaitingPayment(string? paymentStatus) {
            return string.Equals(paymentStatus, "pending_payment", StringComparison.OrdinalIgnoreCase)
                || string.Equals(paymentStatus, "unpaid", StringComparison.OrdinalIgnoreCase);
        }

        private static bool AccountNumbersMatch(string configured, string incoming) {
            static string Norm(string s) => new string(s.Where(char.IsDigit).ToArray());
            var a = Norm(configured);
            var b = Norm(incoming);
            return a.Length > 0 && a == b;
        }

        internal static Invoice CreateInvoice(Order order, int? issuedById, DateTime invoiceDate) {
            var datePart = invoiceDate.ToString("yyyyMMdd");
            var suffix = order.OrderCode.Length >= 6
                ? order.OrderCode[^6..].ToUpper()
                : order.OrderCode.ToUpper();

            return new Invoice {
                OrderId = order.Id,
                InvoiceCode = $"INV-{datePart}-{suffix}",
                InvoiceDate = invoiceDate,
                TotalAmount = order.TotalAmount,
                PaymentStatus = "paid",
                IssuedById = issuedById,
                CreatedAt = invoiceDate
            };
        }
    }
}
