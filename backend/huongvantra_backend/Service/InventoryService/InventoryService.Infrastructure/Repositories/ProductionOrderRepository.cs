using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Domain.Enums;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class ProductionOrderRepository(InventoryDbContext _db) : IProductionOrderRepository
{
    public Task<ProductionOrder?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.ProductionOrders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

    public async Task<(List<ProductionOrder> Items, int Total)> GetPagedAsync(
        ProductionOrderStatus? status, int page, int pageSize, CancellationToken ct = default)
    {
        var query = _db.ProductionOrders.AsQueryable();
        if (status.HasValue)
            query = query.Where(o => o.Status == status.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(o => o.Lines)
            .ToListAsync(ct);

        return (items, total);
    }

    public Task<int> CountCreatedSinceAsync(DateTime since, CancellationToken ct = default) =>
        _db.ProductionOrders.CountAsync(o => o.CreatedAt >= since, ct);

    public async Task AddAsync(ProductionOrder order, CancellationToken ct = default) =>
        await _db.ProductionOrders.AddAsync(order, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
