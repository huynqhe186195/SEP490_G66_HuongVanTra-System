using CustomerService.Domain.Entities;

namespace CustomerService.Application.Interfaces;

public interface ICustomerRepository
{
    Task<Customer?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Customer?> GetByPhoneAsync(string phone, CancellationToken ct = default);
    Task<bool> PhoneExistsAsync(string phone, Guid? excludeCustomerId = null, CancellationToken ct = default);
    Task<IEnumerable<Customer>> GetAllAsync(int page, int pageSize, CancellationToken ct = default);
    Task<int> CountAsync(CancellationToken ct = default);
    Task AddAsync(Customer customer, CancellationToken ct = default);
    void Update(Customer customer);
    Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
