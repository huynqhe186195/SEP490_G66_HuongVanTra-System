using CustomerService.Domain.Entities;

namespace CustomerService.Application.Interfaces;

public interface ICustomerDebtAllocationRepository
{
    Task AddRangeAsync(IEnumerable<CustomerDebtAllocation> allocations, CancellationToken ct = default);
    Task<IReadOnlyList<CustomerDebtAllocation>> GetByCustomerIdAsync(Guid customerId, CancellationToken ct = default);
    Task<IReadOnlyList<CustomerDebtAllocation>> GetByTransactionIdAsync(
        Guid transactionId,
        CancellationToken ct = default);
}
