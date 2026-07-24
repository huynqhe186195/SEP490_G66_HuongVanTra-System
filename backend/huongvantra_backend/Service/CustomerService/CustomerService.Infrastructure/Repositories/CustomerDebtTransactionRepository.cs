using CustomerService.Application.Interfaces;
using CustomerService.Domain.Entities;
using CustomerService.Domain.Enums;
using CustomerService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CustomerService.Infrastructure.Repositories;

public class CustomerDebtTransactionRepository : ICustomerDebtTransactionRepository
{
    private readonly CustomerDbContext _db;

    public CustomerDebtTransactionRepository(CustomerDbContext db) => _db = db;

    public async Task AddAsync(CustomerDebtTransaction transaction, CancellationToken ct = default) =>
        await _db.CustomerDebtTransactions.AddAsync(transaction, ct);

    public async Task<IEnumerable<CustomerDebtTransaction>> GetByCustomerIdAsync(Guid customerId, CancellationToken ct = default) =>
        await _db.CustomerDebtTransactions
            .Where(t => t.CustomerId == customerId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

    public async Task<(decimal TotalIncrease, decimal TotalDecrease, int Count)> GetSummaryAsync(Guid customerId, CancellationToken ct = default)
    {
        var result = await _db.CustomerDebtTransactions
            .Where(t => t.CustomerId == customerId)
            .GroupBy(_ => customerId)
            .Select(g => new
            {
                TotalIncrease = g.Where(t => t.Type == DebtTransactionType.IncreaseDebt).Sum(t => t.Amount),
                TotalDecrease = g.Where(t => t.Type == DebtTransactionType.DecreaseDebt).Sum(t => t.Amount),
                Count = g.Count()
            })
            .FirstOrDefaultAsync(ct);

        return result is null
            ? (0m, 0m, 0)
            : (result.TotalIncrease, result.TotalDecrease, result.Count);
    }

    public async Task<decimal> GetLedgerBalanceAsync(Guid customerId, CancellationToken ct = default)
    {
        var items = await _db.CustomerDebtTransactions
            .Where(t => t.CustomerId == customerId)
            .OrderBy(t => t.CreatedAt)
            .ThenBy(t => t.Id)
            .ToListAsync(ct);

        decimal balance = 0;
        foreach (var transaction in items)
        {
            balance = transaction.Type == DebtTransactionType.IncreaseDebt
                ? balance + transaction.Amount
                : Math.Max(0, balance - transaction.Amount);
        }

        return balance;
    }

    public async Task<bool> HasOrderDebtAsync(Guid orderId, CancellationToken ct = default) =>
        await _db.CustomerDebtTransactions.AnyAsync(
            t => t.Type == DebtTransactionType.IncreaseDebt
                && t.ReferenceType == "Order"
                && t.ReferenceId == orderId,
            ct);

    public async Task<CustomerDebtTransaction?> GetDebtPaymentByIdempotencyKeyAsync(
        Guid customerId,
        string idempotencyKey,
        CancellationToken ct = default) =>
        await _db.CustomerDebtTransactions
            .AsNoTracking()
            .FirstOrDefaultAsync(
                transaction =>
                    transaction.CustomerId == customerId
                    && transaction.Type == DebtTransactionType.DecreaseDebt
                    && transaction.ReferenceType != null
                    && transaction.ReferenceType.StartsWith("DebtPayment:")
                    && transaction.RelatedOrderCode == idempotencyKey,
                ct);

    public async Task<CustomerDebtTransaction?> GetDebtPaymentBySourceOrderAsync(
        Guid customerId,
        Guid sourceOrderId,
        CancellationToken ct = default) =>
        await _db.CustomerDebtTransactions
            .AsNoTracking()
            .FirstOrDefaultAsync(
                transaction =>
                    transaction.CustomerId == customerId
                    && transaction.Type == DebtTransactionType.DecreaseDebt
                    && transaction.ReferenceType == "OrderPayment"
                    && transaction.ReferenceId == sourceOrderId,
                ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
