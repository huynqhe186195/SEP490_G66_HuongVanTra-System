using CustomerService.Application.Interfaces;
using CustomerService.Domain.Entities;
using CustomerService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CustomerService.Infrastructure.Repositories;

public class CustomerTierRepository : ICustomerTierRepository
{
    private readonly CustomerDbContext _db;

    public CustomerTierRepository(CustomerDbContext db) => _db = db;

    public async Task<IEnumerable<CustomerTier>> GetAllAsync(CancellationToken ct = default) =>
        await _db.CustomerTiers.Where(t => !t.IsDeleted).OrderBy(t => t.MinSpendingThreshold).ToListAsync(ct);

    public async Task<IEnumerable<CustomerTier>> GetAllIncludingInactiveAsync(CancellationToken ct = default) =>
        await _db.CustomerTiers.OrderBy(t => t.MinSpendingThreshold).ToListAsync(ct);

    public async Task<CustomerTier?> GetByIdAsync(int id, CancellationToken ct = default) =>
        await _db.CustomerTiers.FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted, ct);

    public async Task<CustomerTier?> GetByIdIncludingInactiveAsync(int id, CancellationToken ct = default) =>
        await _db.CustomerTiers.FirstOrDefaultAsync(t => t.Id == id, ct);

    public async Task<Dictionary<int, int>> GetCustomerCountsByTierAsync(CancellationToken ct = default) =>
        await _db.Customers
            .Where(c => !c.IsDeleted && c.TierId != null)
            .GroupBy(c => c.TierId!.Value)
            .Select(g => new { TierId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TierId, x => x.Count, ct);

    public async Task<CustomerTier?> GetTierForSpendingAsync(decimal totalSpending, CancellationToken ct = default) =>
        await _db.CustomerTiers
            .Where(t => !t.IsDeleted && t.MinSpendingThreshold <= totalSpending)
            .OrderByDescending(t => t.MinSpendingThreshold)
            .FirstOrDefaultAsync(ct);

    public async Task<CustomerTier?> GetDefaultTierAsync(CancellationToken ct = default) =>
        await _db.CustomerTiers
            .Where(t => !t.IsDeleted)
            .OrderBy(t => t.MinSpendingThreshold)
            .FirstOrDefaultAsync(ct);

    public async Task AddAsync(CustomerTier tier, CancellationToken ct = default) =>
        await _db.CustomerTiers.AddAsync(tier, ct);

    public void Update(CustomerTier tier) => _db.CustomerTiers.Update(tier);

    public async Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        await _db.SaveChangesAsync(ct);
}
