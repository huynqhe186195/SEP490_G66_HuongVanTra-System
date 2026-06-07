using CustomerService.Application.Interfaces;
using CustomerService.Domain.Entities;
using CustomerService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CustomerService.Infrastructure.Repositories;

public class CustomerRepository : ICustomerRepository
{
    private readonly CustomerDbContext _db;

    public CustomerRepository(CustomerDbContext db) => _db = db;

    public async Task<Customer?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.Customers
            .Include(c => c.Tier)
            .Include(c => c.Addresses)
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);

    public async Task<Customer?> GetByPhoneAsync(string phone, CancellationToken ct = default) =>
        await _db.Customers.FirstOrDefaultAsync(c => c.PhoneNumber == phone && !c.IsDeleted, ct);

    public async Task<bool> PhoneExistsAsync(string phone, Guid? excludeCustomerId = null, CancellationToken ct = default) =>
        await _db.Customers.AnyAsync(c =>
            c.PhoneNumber == phone &&
            !c.IsDeleted &&
            (!excludeCustomerId.HasValue || c.Id != excludeCustomerId.Value), ct);

    public async Task<IEnumerable<Customer>> GetAllAsync(int page, int pageSize, CancellationToken ct = default) =>
        await _db.Customers
            .Include(c => c.Tier)
            .Where(c => !c.IsDeleted)
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

    public async Task<int> CountAsync(CancellationToken ct = default) =>
        await _db.Customers.CountAsync(c => !c.IsDeleted, ct);

    public async Task AddAsync(Customer customer, CancellationToken ct = default) =>
        await _db.Customers.AddAsync(customer, ct);

    public void Update(Customer customer) => _db.Customers.Update(customer);

    public async Task<bool> ExistsAsync(Guid id, CancellationToken ct = default) =>
        await _db.Customers.AnyAsync(c => c.Id == id && !c.IsDeleted, ct);

    public async Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        await _db.SaveChangesAsync(ct);
}
