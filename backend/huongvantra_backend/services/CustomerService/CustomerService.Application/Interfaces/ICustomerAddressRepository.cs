using CustomerService.Domain.Entities;

namespace CustomerService.Application.Interfaces;

public interface ICustomerAddressRepository
{
    Task<IEnumerable<CustomerAddress>> GetByCustomerIdAsync(Guid customerId, CancellationToken ct = default);
    Task<CustomerAddress?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(CustomerAddress address, CancellationToken ct = default);
    void Update(CustomerAddress address);
    void Delete(CustomerAddress address);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
