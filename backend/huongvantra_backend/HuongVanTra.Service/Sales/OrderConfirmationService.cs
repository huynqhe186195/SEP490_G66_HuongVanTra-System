using HuongVanTra.Core.Entities.Sales;
using HuongVanTra.Core.Entities.System;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Sales.Models;
using Microsoft.EntityFrameworkCore;

namespace HuongVanTra.Service.Sales {
    public class OrderConfirmationService : IOrderConfirmationService {
        private static readonly HashSet<string> PendingPaymentStatuses = new(StringComparer.OrdinalIgnoreCase) {
            "pending_payment",
            "unpaid",
            "PENDING_PAYMENT",
            "UNPAID",
        };

        private readonly AppDbContext _db;

        public OrderConfirmationService(AppDbContext db) {
            _db = db;
        }

        public async Task<OrderConfirmationResult> ConfirmPaymentAsync(
            ConfirmPaymentCommand command,
            CancellationToken cancellationToken = default) {
            var order = await LoadOrderAsync(command.OrderId, cancellationToken);

            if (IsCod(order.PaymentMethod)) {
                throw new InvalidOperationException("COD orders must be confirmed via confirm-cod endpoint.");
            }

            if (!IsPendingPayment(order.PaymentStatus)) {
                throw new InvalidOperationException($"Order {order.Id} is not awaiting payment (current: {order.PaymentStatus}).");
            }

            if (IsCancelled(order.OrderStatus)) {
                throw new InvalidOperationException($"Order {order.Id} is cancelled and cannot be updated.");
            }

            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            try {
                order.PaymentStatus = "paid";
                order.OrderStatus = "completed";
                order.UpdatedAt = DateTime.UtcNow;

                await EnsurePaymentTransactionAsync(order, command.PaymentReference, cancellationToken);

                _db.AuditLogs.Add(new AuditLog {
                    Action = "confirm_payment",
                    EntityType = "orders",
                    EntityId = order.Id,
                    UserId = command.EmployeeId,
                    StoreId = order.StoreId,
                    Status = "SUCCESS",
                    NewValues = BuildAuditNote(command.PaymentReference, command.Note),
                    CreatedAt = DateTime.UtcNow,
                });

                await _db.SaveChangesAsync(cancellationToken);
                await tx.CommitAsync(cancellationToken);

                return ToResult(order);
            }
            catch {
                await tx.RollbackAsync(cancellationToken);
                throw;
            }
        }

        public async Task<OrderConfirmationResult> ConfirmCodCompletedAsync(
            int orderId,
            int employeeId,
            CancellationToken cancellationToken = default) {
            var order = await LoadOrderAsync(orderId, cancellationToken);

            if (!IsCod(order.PaymentMethod)) {
                throw new InvalidOperationException($"Order {orderId} is not a COD order.");
            }

            if (string.Equals(order.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase)) {
                throw new InvalidOperationException($"Order {orderId} has already been marked as paid.");
            }

            if (IsCancelled(order.OrderStatus)) {
                throw new InvalidOperationException($"Order {orderId} is cancelled and cannot be updated.");
            }

            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            try {
                order.PaymentStatus = "paid";
                order.OrderStatus = "completed";
                order.UpdatedAt = DateTime.UtcNow;

                await EnsurePaymentTransactionAsync(order, paymentReference: "COD", cancellationToken);

                _db.AuditLogs.Add(new AuditLog {
                    Action = "confirm_cod_completed",
                    EntityType = "orders",
                    EntityId = order.Id,
                    UserId = employeeId,
                    StoreId = order.StoreId,
                    Status = "SUCCESS",
                    CreatedAt = DateTime.UtcNow,
                });

                await _db.SaveChangesAsync(cancellationToken);
                await tx.CommitAsync(cancellationToken);

                return ToResult(order);
            }
            catch {
                await tx.RollbackAsync(cancellationToken);
                throw;
            }
        }

        private async Task<Order> LoadOrderAsync(int orderId, CancellationToken cancellationToken) {
            return await _db.Orders
                .Include(o => o.PaymentTransactions)
                .FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken)
                ?? throw new ArgumentException($"Order {orderId} does not exist.");
        }

        private async Task EnsurePaymentTransactionAsync(
            Order order,
            string? paymentReference,
            CancellationToken cancellationToken) {
            if (order.PaymentTransactions.Count > 0) {
                return;
            }

            var method = string.IsNullOrWhiteSpace(paymentReference)
                ? order.PaymentMethod
                : paymentReference.Trim();

            _db.PaymentTransactions.Add(new PaymentTransaction {
                OrderId = order.Id,
                PaymentMethod = method.Length > 30 ? method[..30] : method,
                Amount = order.TotalAmount,
                TransactionDate = DateTime.UtcNow,
            });

            await Task.CompletedTask;
        }

        private static bool IsCod(string? paymentMethod) =>
            string.Equals(paymentMethod, "COD", StringComparison.OrdinalIgnoreCase);

        private static bool IsPendingPayment(string? paymentStatus) =>
            !string.IsNullOrWhiteSpace(paymentStatus) && PendingPaymentStatuses.Contains(paymentStatus);

        private static bool IsCancelled(string? orderStatus) =>
            string.Equals(orderStatus, "cancelled", StringComparison.OrdinalIgnoreCase)
            || string.Equals(orderStatus, "CANCELLED", StringComparison.OrdinalIgnoreCase);

        private static string? BuildAuditNote(string? paymentReference, string? note) {
            if (string.IsNullOrWhiteSpace(paymentReference) && string.IsNullOrWhiteSpace(note)) {
                return null;
            }

            return $"ref={paymentReference?.Trim()}; note={note?.Trim()}";
        }

        private static OrderConfirmationResult ToResult(Order order) => new() {
            OrderId = order.Id,
            OrderCode = order.OrderCode,
            PaymentMethod = order.PaymentMethod,
            PaymentStatus = order.PaymentStatus,
            OrderStatus = order.OrderStatus,
            ConfirmedAt = DateTime.UtcNow,
        };
    }
}
