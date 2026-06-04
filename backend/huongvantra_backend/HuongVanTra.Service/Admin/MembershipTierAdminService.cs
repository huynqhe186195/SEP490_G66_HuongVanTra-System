using HuongVanTra.Core.Entities.Customers;
using HuongVanTra.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HuongVanTra.Service.Admin {
    public class MembershipTierAdminService : IMembershipTierAdminService {
        private readonly AppDbContext _db;

        public MembershipTierAdminService(AppDbContext db) {
            _db = db;
        }

        public async Task<IReadOnlyList<MembershipTierAdminItemDto>> ListAsync(
            CancellationToken cancellationToken = default) {
            return await _db.MembershipTiers
                .AsNoTracking()
                .OrderBy(t => t.MinTotalSpend)
                .ThenBy(t => t.TierCode)
                .Select(t => new MembershipTierAdminItemDto {
                    Id               = t.Id,
                    TierCode         = t.TierCode,
                    MinTotalSpend    = t.MinTotalSpend,
                    DiscountPercent  = t.DiscountPercent,
                    CustomerCount    = t.Customers.Count,
                })
                .ToListAsync(cancellationToken);
        }

        public async Task<MembershipTierAdminItemDto?> GetAsync(
            int id, CancellationToken cancellationToken = default) {
            return await _db.MembershipTiers
                .AsNoTracking()
                .Where(t => t.Id == id)
                .Select(t => new MembershipTierAdminItemDto {
                    Id               = t.Id,
                    TierCode         = t.TierCode,
                    MinTotalSpend    = t.MinTotalSpend,
                    DiscountPercent  = t.DiscountPercent,
                    CustomerCount    = t.Customers.Count,
                })
                .FirstOrDefaultAsync(cancellationToken);
        }

        public async Task<MembershipTierAdminItemDto> CreateAsync(
            UpsertMembershipTierRequest request, CancellationToken cancellationToken = default) {
            var normalized = NormalizeRequest(request);
            await EnsureUniqueTierCodeAsync(normalized.TierCode, excludeId: null, cancellationToken);

            var entity = new MembershipTier {
                TierCode        = normalized.TierCode,
                MinTotalSpend   = normalized.MinTotalSpend,
                DiscountPercent = normalized.DiscountPercent,
            };

            _db.MembershipTiers.Add(entity);
            await _db.SaveChangesAsync(cancellationToken);

            return (await GetAsync(entity.Id, cancellationToken))!;
        }

        public async Task<MembershipTierAdminItemDto?> UpdateAsync(
            int id, UpsertMembershipTierRequest request, CancellationToken cancellationToken = default) {
            var entity = await _db.MembershipTiers.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
            if (entity is null) {
                return null;
            }

            var normalized = NormalizeRequest(request);
            await EnsureUniqueTierCodeAsync(normalized.TierCode, excludeId: id, cancellationToken);

            entity.TierCode        = normalized.TierCode;
            entity.MinTotalSpend   = normalized.MinTotalSpend;
            entity.DiscountPercent = normalized.DiscountPercent;

            await _db.SaveChangesAsync(cancellationToken);
            return await GetAsync(id, cancellationToken);
        }

        public async Task DeleteAsync(int id, CancellationToken cancellationToken = default) {
            var entity = await _db.MembershipTiers
                .Include(t => t.Customers)
                .FirstOrDefaultAsync(t => t.Id == id, cancellationToken)
                ?? throw new ArgumentException("Hạng thẻ không tồn tại.");

            if (entity.Customers.Any()) {
                throw new InvalidOperationException(
                    $"Không thể xóa hạng \"{entity.TierCode}\" vì còn {entity.Customers.Count} khách hàng đang gán.");
            }

            _db.MembershipTiers.Remove(entity);
            await _db.SaveChangesAsync(cancellationToken);
        }

        private static UpsertMembershipTierRequest NormalizeRequest(UpsertMembershipTierRequest request) {
            var tierCode = (request.TierCode ?? string.Empty).Trim().ToUpperInvariant();
            if (string.IsNullOrWhiteSpace(tierCode)) {
                throw new ArgumentException("Mã hạng không được để trống.");
            }

            if (request.MinTotalSpend < 0) {
                throw new ArgumentException("Ngưỡng chi tiêu không được âm.");
            }

            if (request.DiscountPercent < 0 || request.DiscountPercent > 100) {
                throw new ArgumentException("Chiết khấu hạng phải từ 0 đến 100%.");
            }

            return new UpsertMembershipTierRequest {
                TierCode        = tierCode,
                MinTotalSpend   = request.MinTotalSpend,
                DiscountPercent = request.DiscountPercent,
            };
        }

        private async Task EnsureUniqueTierCodeAsync(
            string tierCode, int? excludeId, CancellationToken cancellationToken) {
            var exists = await _db.MembershipTiers.AnyAsync(
                t => t.TierCode.ToUpper() == tierCode && (!excludeId.HasValue || t.Id != excludeId.Value),
                cancellationToken);

            if (exists) {
                throw new InvalidOperationException($"Mã hạng \"{tierCode}\" đã tồn tại.");
            }
        }
    }
}
