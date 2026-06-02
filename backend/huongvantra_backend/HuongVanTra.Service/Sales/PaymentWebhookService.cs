using HuongVanTra.Core.Entities.Sales;
using HuongVanTra.Core.Entities.System;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Sales.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HuongVanTra.Service.Sales {
    public class PaymentWebhookService : IPaymentWebhookService {
        private readonly AppDbContext _db;
        private readonly SepaySettings _settings;

        public PaymentWebhookService(AppDbContext db, IOptions<SepaySettings> options) {
            _db = db;
            _settings = options.Value;
        }

        public async Task<WebhookProcessResult> ProcessSepayWebhookAsync(
            SepayWebhookCommand command,
            CancellationToken cancellationToken = default) {

            // Chỉ xử lý giao dịch tiền vào
            if (!string.Equals(command.TransferType, "in", StringComparison.OrdinalIgnoreCase)) {
                return new WebhookProcessResult { Success = true, Skipped = true, Message = "Not an inbound transfer." };
            }

            var orderCode = ExtractOrderCode(command.Content, command.ReferenceCode);
            if (string.IsNullOrWhiteSpace(orderCode)) {
                return new WebhookProcessResult { Success = true, Skipped = true, Message = "No order code found in transfer content." };
            }

            var order = await _db.Orders
                .Include(o => o.PaymentTransactions)
                .FirstOrDefaultAsync(o => o.OrderCode == orderCode, cancellationToken);

            if (order is null) {
                return new WebhookProcessResult { Success = true, Skipped = true, Message = $"Order {orderCode} not found." };
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

            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            try {
                var confirmedAt = DateTime.UtcNow;

                order.PaymentStatus = "paid";
                order.UpdatedAt = confirmedAt;

                var paymentTxn = order.PaymentTransactions.FirstOrDefault();
                if (paymentTxn is not null) {
                    paymentTxn.Status = "paid";
                    paymentTxn.ConfirmedAt = confirmedAt;
                    paymentTxn.ReferenceCode = command.Code ?? paymentTxn.ReferenceCode;
                }

                var invoice = CreateInvoice(order, issuedById: null, confirmedAt);
                _db.Invoices.Add(invoice);

                _db.AuditLogs.Add(new AuditLog {
                    Action = "payment_auto_confirmed_via_webhook",
                    EntityType = "orders",
                    EntityId = order.Id,
                    StoreId = order.StoreId,
                    Status = "SUCCESS",
                    NewValues = $"sepay_txn_id={command.TransactionId};bank_code={command.Code};amount={command.TransferAmount}",
                    CreatedAt = confirmedAt
                });

                await _db.SaveChangesAsync(cancellationToken);
                await tx.CommitAsync(cancellationToken);

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

        /// <summary>Extract order code từ nội dung chuyển khoản. VD: "POS ONL-20260603-ABC123" → "ONL-20260603-ABC123"</summary>
        private static string? ExtractOrderCode(string? content, string? referenceCode) {
            if (!string.IsNullOrWhiteSpace(referenceCode) && referenceCode.Contains('-')) {
                return referenceCode.Trim();
            }

            if (string.IsNullOrWhiteSpace(content)) return null;

            // Pattern: "POS <ORDER_CODE>" hoặc tìm token có dạng ONL-xxx, ORD-xxx, POS-xxx
            var parts = content.Trim().ToUpperInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            foreach (var part in parts) {
                if (part.StartsWith("ONL-") || part.StartsWith("ORD-") || part.StartsWith("POS-")) {
                    return part;
                }
            }

            // Fallback: nếu content là "POS <CODE>", lấy phần sau "POS "
            var upper = content.Trim().ToUpperInvariant();
            if (upper.StartsWith("POS ") && upper.Length > 4) {
                return upper[4..].Trim();
            }

            return null;
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
