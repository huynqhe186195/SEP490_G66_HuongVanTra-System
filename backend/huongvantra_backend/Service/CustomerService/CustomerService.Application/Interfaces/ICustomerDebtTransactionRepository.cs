using CustomerService.Domain.Entities;
using CustomerService.Domain.Enums;

namespace CustomerService.Application.Interfaces;

public interface ICustomerDebtTransactionRepository
{
    Task AddAsync(CustomerDebtTransaction transaction, CancellationToken ct = default);
    Task<IEnumerable<CustomerDebtTransaction>> GetByCustomerIdAsync(Guid customerId, CancellationToken ct = default);
    Task<(decimal TotalIncrease, decimal TotalDecrease, int Count)> GetSummaryAsync(Guid customerId, CancellationToken ct = default);
    Task<decimal> GetLedgerBalanceAsync(Guid customerId, CancellationToken ct = default);
    Task<bool> HasOrderDebtAsync(Guid orderId, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

public interface ICustomerActivityRepository
{
    Task AddAsync(CustomerActivity activity, CancellationToken ct = default);
    Task<IEnumerable<CustomerActivity>> GetByCustomerIdAsync(Guid customerId, int take, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
