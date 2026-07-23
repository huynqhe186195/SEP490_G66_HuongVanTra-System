using CustomerService.Application.Interfaces;
using CustomerService.Domain.Entities;
using CustomerService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CustomerService.Infrastructure.Repositories;

public class CustomerDebtAllocationRepository : ICustomerDebtAllocationRepository
{
    private readonly CustomerDbContext _db;

    public CustomerDebtAllocationRepository(CustomerDbContext db) => _db = db;

    public async Task AddRangeAsync(IEnumerable<CustomerDebtAllocation> allocations, CancellationToken ct = default) =>
        await _db.CustomerDebtAllocations.AddRangeAsync(allocations, ct);

    public async Task<IReadOnlyList<CustomerDebtAllocation>> GetByCustomerIdAsync(Guid customerId, CancellationToken ct = default) =>
        await _db.CustomerDebtAllocations
            .AsNoTracking()
            .Where(a => a.CustomerId == customerId)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<CustomerDebtAllocation>> GetByTransactionIdAsync(
        Guid transactionId,
        CancellationToken ct = default) =>
        await _db.CustomerDebtAllocations
            .AsNoTracking()
            .Where(allocation => allocation.DebtTransactionId == transactionId)
            .OrderBy(allocation => allocation.CreatedAt)
            .ToListAsync(ct);
}
