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
                .OrderByDescending(t => t.IsActive)
                .ThenBy(t => t.MinTotalSpend)
                .ThenBy(t => t.TierCode)
                .Select(t => new MembershipTierAdminItemDto {
                    Id              = t.Id,
                    TierCode        = t.TierCode,
                    MinTotalSpend   = t.MinTotalSpend,
                    DiscountPercent = t.DiscountPercent,
                    CustomerCount   = t.Customers.Count,
                    IsActive        = t.IsActive,
                })
                .ToListAsync(cancellationToken);
        }

        public async Task<MembershipTierAdminItemDto?> GetAsync(
            int id, CancellationToken cancellationToken = default) {
            return await _db.MembershipTiers
                .AsNoTracking()
                .Where(t => t.Id == id)
                .Select(t => new MembershipTierAdminItemDto {
                    Id              = t.Id,
                    TierCode        = t.TierCode,
                    MinTotalSpend   = t.MinTotalSpend,
                    DiscountPercent = t.DiscountPercent,
                    CustomerCount   = t.Customers.Count,
                    IsActive        = t.IsActive,
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
                IsActive        = true,
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

        public async Task<MembershipTierAdminItemDto> DeactivateAsync(
            int id, CancellationToken cancellationToken = default) {
            var entity = await _db.MembershipTiers.FirstOrDefaultAsync(t => t.Id == id, cancellationToken)
                ?? throw new ArgumentException("Hạng thẻ không tồn tại.");

            if (!entity.IsActive) {
                return (await GetAsync(id, cancellationToken))!;
            }

            entity.IsActive = false;
            await _db.SaveChangesAsync(cancellationToken);
            return (await GetAsync(id, cancellationToken))!;
        }

        public async Task<MembershipTierAdminItemDto> ReactivateAsync(
            int id, CancellationToken cancellationToken = default) {
            var entity = await _db.MembershipTiers.FirstOrDefaultAsync(t => t.Id == id, cancellationToken)
                ?? throw new ArgumentException("Hạng thẻ không tồn tại.");

            if (entity.IsActive) {
                return (await GetAsync(id, cancellationToken))!;
            }

            await EnsureUniqueTierCodeAsync(entity.TierCode, excludeId: id, cancellationToken);
            entity.IsActive = true;
            await _db.SaveChangesAsync(cancellationToken);
            return (await GetAsync(id, cancellationToken))!;
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
                t => t.IsActive
                     && t.TierCode.ToUpper() == tierCode
                     && (!excludeId.HasValue || t.Id != excludeId.Value),
                cancellationToken);

            if (exists) {
                throw new InvalidOperationException($"Mã hạng \"{tierCode}\" đã tồn tại.");
            }
        }
    }
}
