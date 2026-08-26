using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

public class CustomBundleRepository(OrderDbContext _db) : ICustomBundleRepository
{
    public async Task<CustomBundle?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.CustomBundles
            .Include(b => b.Ingredients)
            .Include(b => b.Order)
            .FirstOrDefaultAsync(b => b.Id == id, ct);

    public async Task<(List<CustomBundle> Items, int TotalCount)> GetPagedByStatusAsync(
        PackingStatus status, int page, int pageSize, CancellationToken ct = default)
    {
        var query = _db.CustomBundles
            .Include(b => b.Ingredients)
            .Include(b => b.Order)
            .Where(b => b.PackingStatus == status);

        // Chờ đóng gói: ẩn gói thuộc đơn đã hủy / đang xin hủy (kể cả bản ghi Pending cũ chưa kịp Cancelled).
        if (status == PackingStatus.Pending)
        {
            query = query.Where(b =>
                b.Order == null
                || (b.Order.OrderStatus != OrderStatus.Cancelled
                    && b.Order.OrderStatus != OrderStatus.CancellationRequested));
        }
        // Tab Đã hủy: gồm gói Cancelled + Pending sót trên đơn đã hủy (dữ liệu cũ).
        else if (status == PackingStatus.Cancelled)
        {
            query = _db.CustomBundles
                .Include(b => b.Ingredients)
                .Include(b => b.Order)
                .Where(b =>
                    b.PackingStatus == PackingStatus.Cancelled
                    || (b.PackingStatus == PackingStatus.Pending
                        && b.Order != null
                        && (b.Order.OrderStatus == OrderStatus.Cancelled
                            || b.Order.OrderStatus == OrderStatus.CancellationRequested)));
        }

        var filtered = query.OrderByDescending(b => b.CreatedAt);
        var total = await filtered.CountAsync(ct);
        var items = await filtered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        await _db.SaveChangesAsync(ct);
}
