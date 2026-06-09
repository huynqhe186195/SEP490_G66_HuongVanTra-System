using CustomerService.Domain.Entities;

namespace CustomerService.Application.Interfaces;

public interface ICustomerTierRepository
{
    Task<IEnumerable<CustomerTier>> GetAllAsync(CancellationToken ct = default);
    Task<CustomerTier?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<CustomerTier?> GetTierForSpendingAsync(decimal totalSpending, CancellationToken ct = default);
    Task<CustomerTier?> GetDefaultTierAsync(CancellationToken ct = default);
    Task AddAsync(CustomerTier tier, CancellationToken ct = default);
    void Update(CustomerTier tier);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
