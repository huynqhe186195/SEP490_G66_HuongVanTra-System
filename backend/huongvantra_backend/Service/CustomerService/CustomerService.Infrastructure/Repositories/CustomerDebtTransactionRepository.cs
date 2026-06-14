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
        var items = await _db.CustomerDebtTransactions
            .Where(t => t.CustomerId == customerId)
            .ToListAsync(ct);

        var increase = items.Where(t => t.Type == DebtTransactionType.IncreaseDebt).Sum(t => t.Amount);
        var decrease = items.Where(t => t.Type == DebtTransactionType.DecreaseDebt).Sum(t => t.Amount);
        return (increase, decrease, items.Count);
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

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
