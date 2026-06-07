using CustomerService.Application.Interfaces;
using CustomerService.Domain.Entities;
using CustomerService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CustomerService.Infrastructure.Repositories;

public class CustomerActivityRepository : ICustomerActivityRepository
{
    private readonly CustomerDbContext _db;

    public CustomerActivityRepository(CustomerDbContext db) => _db = db;

    public async Task AddAsync(CustomerActivity activity, CancellationToken ct = default) =>
        await _db.CustomerActivities.AddAsync(activity, ct);

    public async Task<IEnumerable<CustomerActivity>> GetByCustomerIdAsync(Guid customerId, int take, CancellationToken ct = default) =>
        await _db.CustomerActivities
            .Where(a => a.CustomerId == customerId)
            .OrderByDescending(a => a.CreatedAt)
            .Take(take)
            .ToListAsync(ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
