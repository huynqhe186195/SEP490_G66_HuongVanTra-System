using CustomerService.Application.Interfaces;
using CustomerService.Domain.Entities;
using CustomerService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CustomerService.Infrastructure.Repositories;

public class CustomerAddressRepository : ICustomerAddressRepository
{
    private readonly CustomerDbContext _db;

    public CustomerAddressRepository(CustomerDbContext db) => _db = db;

    public async Task<IEnumerable<CustomerAddress>> GetByCustomerIdAsync(Guid customerId, CancellationToken ct = default) =>
        await _db.CustomerAddresses
            .Where(a => a.CustomerId == customerId && !a.IsDeleted)
            .OrderByDescending(a => a.IsDefault)
            .ToListAsync(ct);

    public async Task<CustomerAddress?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.CustomerAddresses.FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted, ct);

    public async Task AddAsync(CustomerAddress address, CancellationToken ct = default) =>
        await _db.CustomerAddresses.AddAsync(address, ct);

    public void Update(CustomerAddress address) => _db.CustomerAddresses.Update(address);

    public void Delete(CustomerAddress address)
    {
        address.IsDeleted = true;
        _db.CustomerAddresses.Update(address);
    }

    public async Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        await _db.SaveChangesAsync(ct);
}
