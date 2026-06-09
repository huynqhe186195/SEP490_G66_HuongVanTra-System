using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Services;

public class OrderCodeGenerator(OrderDbContext _db) : IOrderCodeGenerator
{
    public async Task<string> GenerateAsync(CancellationToken ct = default)
    {
        var today = DateTime.UtcNow.ToString("yyMMdd");
        var prefix = $"HVT-{today}-";

        var lastCode = await _db.Orders
            .Where(o => o.OrderCode.StartsWith(prefix))
            .OrderByDescending(o => o.OrderCode)
            .Select(o => o.OrderCode)
            .FirstOrDefaultAsync(ct);

        int seq = 1;
        if (lastCode != null)
        {
            var parts = lastCode.Split('-');
            if (parts.Length == 3 && int.TryParse(parts[2], out var last))
                seq = last + 1;
        }

        return $"{prefix}{seq:D3}";
    }
}
