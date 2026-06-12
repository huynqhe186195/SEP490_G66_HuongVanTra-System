using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class ReturnOrderRepository(OrderDbContext _db) : IReturnOrderRepository
{
    public async Task<string> GenerateReturnCodeAsync(CancellationToken ct = default)
    {
        var today = DateTime.UtcNow.ToString("yyMMdd");
        var prefix = $"TH-{today}-";

        var lastCode = await _db.ReturnOrders
            .Where(r => r.ReturnCode.StartsWith(prefix))
            .OrderByDescending(r => r.ReturnCode)
            .Select(r => r.ReturnCode)
            .FirstOrDefaultAsync(ct);

        var seq = 1;
        if (lastCode != null)
        {
            var parts = lastCode.Split('-');
            if (parts.Length == 3 && int.TryParse(parts[2], out var last))
                seq = last + 1;
        }

        return $"{prefix}{seq:D3}";
    }

    public async Task AddAsync(ReturnOrder returnOrder, CancellationToken ct = default) =>
        await _db.ReturnOrders.AddAsync(returnOrder, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
