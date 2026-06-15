using DocumentService.Application.Interfaces;
using DocumentService.Domain.Entities;
using DocumentService.Domain.Enums;
using DocumentService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace DocumentService.Infrastructure.Repositories;

public class ContractRepository(DocumentDbContext db) : IContractRepository
{
    public async Task<(List<Contract> Items, int Total)> GetPagedAsync(
        string? search,
        Guid? customerId,
        ContractStatus? status,
        Guid? createdByUserId,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = db.Contracts.AsQueryable();

        if (customerId.HasValue)
            query = query.Where(c => c.CustomerId == customerId.Value);

        if (status.HasValue)
            query = query.Where(c => c.Status == status.Value);

        if (createdByUserId.HasValue)
            query = query.Where(c => c.CreatedByUserId == createdByUserId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(c =>
                c.Title.ToLower().Contains(term) ||
                c.ContractCode.ToLower().Contains(term) ||
                c.CustomerName.ToLower().Contains(term));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public Task<Contract?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Contracts.FirstOrDefaultAsync(c => c.Id == id, ct);

    public async Task AddAsync(Contract contract, CancellationToken ct = default) =>
        await db.Contracts.AddAsync(contract, ct);

    public void Update(Contract contract) =>
        db.Contracts.Update(contract);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        db.SaveChangesAsync(ct);

    public async Task<string> GenerateNextContractCodeAsync(CancellationToken ct = default)
    {
        var year = DateTime.UtcNow.Year;
        var count = await db.Contracts
            .IgnoreQueryFilters()
            .CountAsync(c => c.CreatedAt.Year == year, ct);
        return $"HD-{year}-{count + 1:D4}";
    }
}
