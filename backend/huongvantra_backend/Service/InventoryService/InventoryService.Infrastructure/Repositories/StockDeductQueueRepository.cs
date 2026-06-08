using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class StockDeductQueueRepository(InventoryDbContext _db) : IStockDeductQueueRepository
{
    public Task<StockDeductQueue?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.StockDeductQueues
            .Include(q => q.Items)
            .FirstOrDefaultAsync(q => q.Id == id, ct);

    public Task<StockDeductQueue?> GetByOrderIdAsync(Guid orderId, CancellationToken ct = default) =>
        _db.StockDeductQueues
            .Include(q => q.Items)
            .FirstOrDefaultAsync(q => q.OrderId == orderId, ct);

    public async Task<List<StockDeductQueue>> GetWaitingAsync(string? search, CancellationToken ct = default)
    {
        var query = _db.StockDeductQueues
            .Where(q => q.QueueStatus == QueueStatus.Waiting);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(q => q.OrderCode.ToLower().Contains(s));
        }

        return await query.OrderByDescending(q => q.CreatedAt).ToListAsync(ct);
    }

    public async Task AddAsync(StockDeductQueue queue, CancellationToken ct = default) =>
        await _db.StockDeductQueues.AddAsync(queue, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
