using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class PosCashSessionRepository(OrderDbContext _db) : IPosCashSessionRepository
{
    public async Task<PosCashSession?> GetOpenAsync(CancellationToken ct = default) =>
        await _db.PosCashSessions
            .Where(s => s.Status == PosCashSessionStatus.Open)
            .OrderByDescending(s => s.OpenedAt)
            .FirstOrDefaultAsync(ct);

    public async Task<PosCashSession?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.PosCashSessions.FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task AddAsync(PosCashSession session, CancellationToken ct = default) =>
        await _db.PosCashSessions.AddAsync(session, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
