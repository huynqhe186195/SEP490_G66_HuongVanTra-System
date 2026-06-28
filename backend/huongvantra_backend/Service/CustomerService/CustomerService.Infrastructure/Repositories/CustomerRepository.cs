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
        await _db.Customers
            .Include(c => c.Tier)
            .Include(c => c.Addresses)
            .FirstOrDefaultAsync(c => c.PhoneNumber == phone && !c.IsDeleted, ct);

    public async Task<bool> PhoneExistsAsync(string phone, Guid? excludeCustomerId = null, CancellationToken ct = default) =>
        await _db.Customers.AnyAsync(c =>
            c.PhoneNumber == phone &&
            !c.IsDeleted &&
            (!excludeCustomerId.HasValue || c.Id != excludeCustomerId.Value), ct);

    public async Task<bool> EmailExistsAsync(string email, Guid? excludeCustomerId = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;

        var normalized = email.Trim().ToLowerInvariant();
        return await _db.Customers.AnyAsync(c =>
            c.Email != null &&
            c.Email.ToLower() == normalized &&
            !c.IsDeleted &&
            (!excludeCustomerId.HasValue || c.Id != excludeCustomerId.Value), ct);
    }

    public async Task<IEnumerable<Customer>> GetAllAsync(int page, int pageSize, Guid? assignedSaleId = null, CancellationToken ct = default) =>
        await _db.Customers
            .Include(c => c.Tier)
            .Where(c => !c.IsDeleted && (!assignedSaleId.HasValue || c.AssignedSaleId == assignedSaleId.Value))
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

    public async Task<IEnumerable<Customer>> GetAllForExportAsync(Guid? assignedSaleId = null, bool includeDeleted = false, CancellationToken ct = default)
    {
        var query = _db.Customers
            .Include(c => c.Tier)
            .Include(c => c.Addresses)
            .AsQueryable();

        query = includeDeleted
            ? query.Where(c => c.IsDeleted)
            : query.Where(c => !c.IsDeleted);

        if (assignedSaleId.HasValue)
            query = query.Where(c => c.AssignedSaleId == assignedSaleId.Value);

        return await query
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<int> CountAsync(Guid? assignedSaleId = null, CancellationToken ct = default) =>
        await _db.Customers.CountAsync(c => !c.IsDeleted && (!assignedSaleId.HasValue || c.AssignedSaleId == assignedSaleId.Value), ct);

    public async Task AddAsync(Customer customer, CancellationToken ct = default) =>
        await _db.Customers.AddAsync(customer, ct);

    public async Task<string> GenerateNextCustomerCodeAsync(CancellationToken ct = default)
    {
        const string prefix = "KH";
        var codes = await _db.Customers
            .AsNoTracking()
            .Where(c => c.CustomerCode.StartsWith(prefix))
            .Select(c => c.CustomerCode)
            .ToListAsync(ct);

        var max = 0;
        foreach (var code in codes)
        {
            if (code.Length > prefix.Length &&
                int.TryParse(code[prefix.Length..], out var number))
            {
                max = Math.Max(max, number);
            }
        }

        return $"{prefix}{(max + 1).ToString().PadLeft(6, '0')}";
    }

    public void Update(Customer customer) => _db.Customers.Update(customer);

    public async Task SoftDeleteAsync(Guid id, CancellationToken ct = default)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct)
            ?? throw new InvalidOperationException($"Customer '{id}' not found.");

        customer.IsDeleted = true;
        customer.UpdatedAt = DateTime.UtcNow;
    }

    public async Task<Customer?> GetByIdIncludingDeletedAsync(Guid id, CancellationToken ct = default) =>
        await _db.Customers
            .Include(c => c.Tier)
            .Include(c => c.Addresses)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

    public async Task RestoreAsync(Guid id, CancellationToken ct = default)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new InvalidOperationException($"Customer '{id}' not found.");

        if (!customer.IsDeleted)
            throw new InvalidOperationException($"Customer '{id}' is not deleted.");

        customer.IsDeleted = false;
        customer.UpdatedAt = DateTime.UtcNow;
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken ct = default) =>
        await _db.Customers.AnyAsync(c => c.Id == id && !c.IsDeleted, ct);

    public async Task<bool> IsDeletedAsync(Guid id, CancellationToken ct = default) =>
        await _db.Customers.AnyAsync(c => c.Id == id && c.IsDeleted, ct);

    public async Task<int> CountCreatedSinceAsync(DateTime sinceUtc, Guid? assignedSaleId = null, CancellationToken ct = default) =>
        await _db.Customers.CountAsync(c =>
            !c.IsDeleted &&
            c.CreatedAt >= sinceUtc &&
            (!assignedSaleId.HasValue || c.AssignedSaleId == assignedSaleId.Value), ct);

    public async Task<IEnumerable<Customer>> GetTopSpendersAsync(int take, Guid? assignedSaleId = null, CancellationToken ct = default) =>
        await _db.Customers
            .Include(c => c.Tier)
            .Where(c => !c.IsDeleted && (!assignedSaleId.HasValue || c.AssignedSaleId == assignedSaleId.Value))
            .OrderByDescending(c => c.TotalSpending)
            .Take(take)
            .ToListAsync(ct);

    public async Task<IEnumerable<Customer>> GetTopDebtorsAsync(int take, Guid? assignedSaleId = null, CancellationToken ct = default) =>
        await _db.Customers
            .Include(c => c.Tier)
            .Where(c => !c.IsDeleted && c.CurrentDebt > 0 && (!assignedSaleId.HasValue || c.AssignedSaleId == assignedSaleId.Value))
            .OrderByDescending(c => c.CurrentDebt)
            .Take(take)
            .ToListAsync(ct);

    public async Task<IEnumerable<(string TierName, int Count)>> CountByTierAsync(Guid? assignedSaleId = null, CancellationToken ct = default)
    {
        var grouped = await _db.Customers
            .Where(c => !c.IsDeleted && (!assignedSaleId.HasValue || c.AssignedSaleId == assignedSaleId.Value))
            .GroupBy(c => c.Tier != null ? c.Tier.TierName : "Chưa có hạng")
            .Select(g => new { TierName = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return grouped.Select(x => (x.TierName, x.Count));
    }

    public async Task<IEnumerable<Customer>> GetAllDeletedAsync(int page, int pageSize, Guid? assignedSaleId = null, CancellationToken ct = default) =>
        await _db.Customers
            .Include(c => c.Tier)
            .Where(c => c.IsDeleted && (!assignedSaleId.HasValue || c.AssignedSaleId == assignedSaleId.Value))
            .OrderByDescending(c => c.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

    public async Task<int> CountDeletedAsync(Guid? assignedSaleId = null, CancellationToken ct = default) =>
        await _db.Customers.CountAsync(c => c.IsDeleted && (!assignedSaleId.HasValue || c.AssignedSaleId == assignedSaleId.Value), ct);

    public async Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        await _db.SaveChangesAsync(ct);

    public void ClearChangeTracker() => _db.ChangeTracker.Clear();
}
