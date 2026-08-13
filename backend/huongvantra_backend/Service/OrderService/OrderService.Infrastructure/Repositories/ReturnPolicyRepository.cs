using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class ReturnPolicyRepository(OrderDbContext db) : IReturnPolicyRepository
{
    public Task<ReturnPolicy?> GetActiveAsync(CancellationToken ct = default) =>
        db.ReturnPolicies
            .AsNoTracking()
            .Where(p => p.IsActive)
            .OrderByDescending(p => p.Version)
            .FirstOrDefaultAsync(ct);
}
