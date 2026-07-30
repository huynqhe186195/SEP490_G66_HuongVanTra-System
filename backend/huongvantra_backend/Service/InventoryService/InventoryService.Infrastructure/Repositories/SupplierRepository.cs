using InventoryService.Application.Interfaces;
using InventoryService.Domain.Entities;
using InventoryService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InventoryService.Infrastructure.Repositories;

public class SupplierRepository(InventoryDbContext _db) : ISupplierRepository
{
    private const int GeneratedCodeMaxAttempts = 5;

    public Task<Supplier?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task<(List<Supplier> Items, int TotalCount)> GetPagedAsync(
        string? search,
        bool includeDeleted,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _db.Suppliers.AsNoTracking().AsQueryable();

        if (!includeDeleted)
            query = query.Where(s => !s.IsDeleted);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(s =>
                s.SupplierCode.ToLower().Contains(keyword) ||
                s.Name.ToLower().Contains(keyword) ||
                (s.Phone != null && s.Phone.Contains(keyword)) ||
                (s.Email != null && s.Email.ToLower().Contains(keyword)) ||
                (s.Address != null && s.Address.ToLower().Contains(keyword)));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(s => s.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public Task<List<Supplier>> GetActiveListAsync(CancellationToken ct = default) =>
        _db.Suppliers.AsNoTracking()
            .Where(s => !s.IsDeleted)
            .OrderBy(s => s.Name)
            .ToListAsync(ct);

    // Unique toàn hệ thống: không loại trừ nhà cung cấp đã xóa mềm.
    public Task<bool> NormalizedCodeExistsAsync(
        string normalizedCode,
        Guid? excludeSupplierId = null,
        CancellationToken ct = default) =>
        _db.Suppliers.AsNoTracking()
            .AnyAsync(
                s => s.NormalizedSupplierCode == normalizedCode
                    && (excludeSupplierId == null || s.Id != excludeSupplierId),
                ct);

    public async Task<int> GetMaxGeneratedCodeSequenceAsync(CancellationToken ct = default)
    {
        var candidates = await _db.Suppliers.AsNoTracking()
            .Where(s => s.NormalizedSupplierCode.StartsWith("NCC-")
                && s.NormalizedSupplierCode.Length == 10)
            .Select(s => s.NormalizedSupplierCode)
            .ToListAsync(ct);

        var max = 0;
        foreach (var code in candidates)
        {
            var digits = code[4..];
            if (digits.Length != 6 || !digits.All(char.IsAsciiDigit))
                continue;
            if (int.TryParse(digits, out var sequence) && sequence > max)
                max = sequence;
        }

        return max;
    }

    public async Task AddWithGeneratedCodeAsync(Supplier supplier, CancellationToken ct = default)
    {
        await _db.Suppliers.AddAsync(supplier, ct);
        var sequence = await GetMaxGeneratedCodeSequenceAsync(ct);

        for (var attempt = 0; attempt < GeneratedCodeMaxAttempts; attempt++)
        {
            sequence++;
            var code = $"NCC-{sequence:D6}";
            supplier.SupplierCode = code;
            supplier.NormalizedSupplierCode = code;

            try
            {
                await _db.SaveChangesAsync(ct);
                return;
            }
            catch (DbUpdateException)
            {
                // Unique index từ chối vì request khác vừa chiếm số này — thử số kế tiếp.
                sequence = Math.Max(sequence, await GetMaxGeneratedCodeSequenceAsync(ct));
            }
        }

        throw new InvalidOperationException("Không sinh được Mã Nhà Cung Cấp sau nhiều lần thử.");
    }

    public async Task AddAsync(Supplier supplier, CancellationToken ct = default) =>
        await _db.Suppliers.AddAsync(supplier, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
