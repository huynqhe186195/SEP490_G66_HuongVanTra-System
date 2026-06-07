using CustomerService.Domain.Entities;

namespace CustomerService.Application.Interfaces;

public interface ICustomerRepository
{
    Task<Customer?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Customer?> GetByPhoneAsync(string phone, CancellationToken ct = default);
    Task<bool> PhoneExistsAsync(string phone, Guid? excludeCustomerId = null, CancellationToken ct = default);
    Task<bool> EmailExistsAsync(string email, Guid? excludeCustomerId = null, CancellationToken ct = default);
    Task<IEnumerable<Customer>> GetAllAsync(int page, int pageSize, CancellationToken ct = default);
    Task<int> CountAsync(CancellationToken ct = default);
    Task<string> GenerateNextCustomerCodeAsync(CancellationToken ct = default);
    Task AddAsync(Customer customer, CancellationToken ct = default);
    void Update(Customer customer);
    Task SoftDeleteAsync(Guid id, CancellationToken ct = default);
    Task<Customer?> GetByIdIncludingDeletedAsync(Guid id, CancellationToken ct = default);
    Task RestoreAsync(Guid id, CancellationToken ct = default);
    Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);
    Task<bool> IsDeletedAsync(Guid id, CancellationToken ct = default);
    Task<int> CountCreatedSinceAsync(DateTime sinceUtc, CancellationToken ct = default);
    Task<IEnumerable<Customer>> GetTopSpendersAsync(int take, CancellationToken ct = default);
    Task<IEnumerable<Customer>> GetTopDebtorsAsync(int take, CancellationToken ct = default);
    Task<IEnumerable<(string TierName, int Count)>> CountByTierAsync(CancellationToken ct = default);
    Task<IEnumerable<Customer>> GetAllDeletedAsync(int page, int pageSize, CancellationToken ct = default);
    Task<int> CountDeletedAsync(CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
