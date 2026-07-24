using Microsoft.EntityFrameworkCore;
using MySqlConnector;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Exceptions;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class OrderReceiptPrintLogRepository(OrderDbContext db) : IOrderReceiptPrintLogRepository
{
    public async Task AddAsync(OrderReceiptPrintLog log, CancellationToken ct = default) =>
        await db.OrderReceiptPrintLogs.AddAsync(log, ct);

    public async Task<List<OrderReceiptPrintLog>> GetByOrderIdAsync(Guid orderId, CancellationToken ct = default) =>
        await db.OrderReceiptPrintLogs
            .AsNoTracking()
            .Where(log => log.OrderId == orderId)
            .OrderBy(log => log.ReprintNumber)
            .ToListAsync(ct);

    public async Task<OrderReceiptPrintLog?> GetByIdempotencyKeyAsync(
        string idempotencyKey, CancellationToken ct = default) =>
        await db.OrderReceiptPrintLogs
            .AsNoTracking()
            .FirstOrDefaultAsync(log => log.IdempotencyKey == idempotencyKey, ct);

    public async Task<int> GetLastReprintNumberAsync(Guid orderId, CancellationToken ct = default) =>
        await db.OrderReceiptPrintLogs
            .Where(log => log.OrderId == orderId)
            .Select(log => (int?)log.ReprintNumber)
            .MaxAsync(ct) ?? 0;

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        try
        {
            return await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException exception) when (IsDuplicateKeyConflict(exception))
        {
            throw new DuplicateOrderIdempotencyKeyException(exception);
        }
    }

    private static bool IsDuplicateKeyConflict(DbUpdateException exception) =>
        exception.InnerException is MySqlException { Number: 1062 };
}
