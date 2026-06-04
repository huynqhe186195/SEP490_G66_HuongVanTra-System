using HuongVanTra.Core.Entities.Sales;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Sales;
using Microsoft.EntityFrameworkCore;

namespace HuongVanTra.Service.Admin {
    public class PromotionAdminService : IPromotionAdminService {
        private readonly AppDbContext _db;

        private static readonly HashSet<string> AllowedDiscountTypes =
            new(StringComparer.OrdinalIgnoreCase) { "PERCENTAGE", "FIXED" };

        public PromotionAdminService(AppDbContext db) {
            _db = db;
        }

        public async Task<IReadOnlyList<PromotionAdminItemDto>> ListAsync(
            CancellationToken cancellationToken = default) {
            var items = await _db.OrderPromotions
                .AsNoTracking()
                .OrderByDescending(p => p.IsActive)
                .ThenBy(p => p.PromoCode)
                .Select(p => new {
                    p.Id,
                    p.PromoCode,
                    p.DiscountType,
                    p.DiscountValue,
                    p.ValidFromUtc,
                    p.ValidToUtc,
                    p.IsActive,
                    OrderCount = p.Orders.Count,
                })
                .ToListAsync(cancellationToken);

            return items
                .Select(p => MapItem(
                    p.Id,
                    p.PromoCode,
                    p.DiscountType,
                    p.DiscountValue,
                    p.ValidFromUtc,
                    p.ValidToUtc,
                    p.IsActive,
                    p.OrderCount))
                .ToList();
        }

        public async Task<PromotionAdminItemDto?> GetAsync(
            int id, CancellationToken cancellationToken = default) {
            var item = await _db.OrderPromotions
                .AsNoTracking()
                .Where(p => p.Id == id)
                .Select(p => new {
                    p.Id,
                    p.PromoCode,
                    p.DiscountType,
                    p.DiscountValue,
                    p.ValidFromUtc,
                    p.ValidToUtc,
                    p.IsActive,
                    OrderCount = p.Orders.Count,
                })
                .FirstOrDefaultAsync(cancellationToken);

            return item is null
                ? null
                : MapItem(
                    item.Id,
                    item.PromoCode,
                    item.DiscountType,
                    item.DiscountValue,
                    item.ValidFromUtc,
                    item.ValidToUtc,
                    item.IsActive,
                    item.OrderCount);
        }

        public async Task<PromotionAdminItemDto> CreateAsync(
            UpsertPromotionRequest request, CancellationToken cancellationToken = default) {
            var normalized = NormalizeRequest(request);
            await EnsureUniquePromoCodeAsync(normalized.PromoCode, excludeId: null, cancellationToken);

            var entity = new OrderPromotion {
                PromoCode     = normalized.PromoCode,
                DiscountType  = normalized.DiscountType,
                DiscountValue = normalized.DiscountValue,
                ValidFromUtc  = normalized.ValidFromUtc,
                ValidToUtc    = normalized.ValidToUtc,
                IsActive      = true,
            };

            _db.OrderPromotions.Add(entity);
            await _db.SaveChangesAsync(cancellationToken);

            return (await GetAsync(entity.Id, cancellationToken))!;
        }

        public async Task<PromotionAdminItemDto?> UpdateAsync(
            int id, UpsertPromotionRequest request, CancellationToken cancellationToken = default) {
            var entity = await _db.OrderPromotions
                .Include(p => p.Orders)
                .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
            if (entity is null) {
                return null;
            }

            var normalized = NormalizeRequest(request);
            var orderCount = entity.Orders.Count;

            if (orderCount > 0) {
                var codeChanged = !string.Equals(entity.PromoCode, normalized.PromoCode, StringComparison.OrdinalIgnoreCase);
                var typeChanged = !string.Equals(entity.DiscountType, normalized.DiscountType, StringComparison.OrdinalIgnoreCase);
                var valueChanged = entity.DiscountValue != normalized.DiscountValue;

                if (codeChanged || typeChanged || valueChanged) {
                    throw new InvalidOperationException(
                        $"Mã đã có {orderCount} đơn sử dụng. Chỉ có thể đổi thời hạn (ngừng hiệu lực bằng ngày kết thúc).");
                }

                entity.ValidFromUtc = normalized.ValidFromUtc;
                entity.ValidToUtc = normalized.ValidToUtc;
            } else {
                await EnsureUniquePromoCodeAsync(normalized.PromoCode, excludeId: id, cancellationToken);

                entity.PromoCode     = normalized.PromoCode;
                entity.DiscountType  = normalized.DiscountType;
                entity.DiscountValue = normalized.DiscountValue;
                entity.ValidFromUtc  = normalized.ValidFromUtc;
                entity.ValidToUtc    = normalized.ValidToUtc;
            }

            await _db.SaveChangesAsync(cancellationToken);
            return await GetAsync(id, cancellationToken);
        }

        public async Task<PromotionAdminItemDto> DeactivateAsync(
            int id, CancellationToken cancellationToken = default) {
            var entity = await _db.OrderPromotions.FirstOrDefaultAsync(p => p.Id == id, cancellationToken)
                ?? throw new ArgumentException("Mã giảm giá không tồn tại.");

            if (!entity.IsActive) {
                return (await GetAsync(id, cancellationToken))!;
            }

            entity.IsActive = false;
            await _db.SaveChangesAsync(cancellationToken);
            return (await GetAsync(id, cancellationToken))!;
        }

        public async Task<PromotionAdminItemDto> ReactivateAsync(
            int id, CancellationToken cancellationToken = default) {
            var entity = await _db.OrderPromotions.FirstOrDefaultAsync(p => p.Id == id, cancellationToken)
                ?? throw new ArgumentException("Mã giảm giá không tồn tại.");

            if (entity.IsActive) {
                return (await GetAsync(id, cancellationToken))!;
            }

            await EnsureUniquePromoCodeAsync(entity.PromoCode, excludeId: id, cancellationToken);
            entity.IsActive = true;
            await _db.SaveChangesAsync(cancellationToken);
            return (await GetAsync(id, cancellationToken))!;
        }

        private static PromotionAdminItemDto MapItem(
            int id,
            string promoCode,
            string discountType,
            decimal discountValue,
            DateTime? validFromUtc,
            DateTime? validToUtc,
            bool isActive,
            int orderCount) {
            var promotion = new OrderPromotion {
                ValidFromUtc = validFromUtc,
                ValidToUtc   = validToUtc,
                IsActive     = isActive,
            };

            return new PromotionAdminItemDto {
                Id             = id,
                PromoCode      = promoCode,
                DiscountType   = discountType,
                DiscountValue  = discountValue,
                ValidFromUtc   = validFromUtc,
                ValidToUtc     = validToUtc,
                ValidityStatus = PromotionValidity.GetDisplayStatus(promotion),
                OrderCount     = orderCount,
                IsActive       = isActive,
            };
        }

        private static NormalizedPromotionRequest NormalizeRequest(UpsertPromotionRequest request) {
            var promoCode = (request.PromoCode ?? string.Empty).Trim().ToUpperInvariant();
            if (string.IsNullOrWhiteSpace(promoCode)) {
                throw new ArgumentException("Mã giảm giá không được để trống.");
            }

            var discountType = (request.DiscountType ?? "PERCENTAGE").Trim().ToUpperInvariant();
            if (!AllowedDiscountTypes.Contains(discountType)) {
                throw new ArgumentException("Loại giảm giá phải là PERCENTAGE hoặc FIXED.");
            }

            if (request.DiscountValue <= 0) {
                throw new ArgumentException("Giá trị giảm phải lớn hơn 0.");
            }

            if (discountType == "PERCENTAGE" && request.DiscountValue > 100) {
                throw new ArgumentException("Giảm theo % không được vượt quá 100.");
            }

            var (validFromUtc, validToUtc) = PromotionValidity.NormalizeValidityRange(request.ValidFrom, request.ValidTo);

            return new NormalizedPromotionRequest {
                PromoCode     = promoCode,
                DiscountType  = discountType,
                DiscountValue = request.DiscountValue,
                ValidFromUtc  = validFromUtc,
                ValidToUtc    = validToUtc,
            };
        }

        private async Task EnsureUniquePromoCodeAsync(
            string promoCode, int? excludeId, CancellationToken cancellationToken) {
            var exists = await _db.OrderPromotions.AnyAsync(
                p => p.IsActive
                     && p.PromoCode.ToUpper() == promoCode
                     && (!excludeId.HasValue || p.Id != excludeId.Value),
                cancellationToken);

            if (exists) {
                throw new InvalidOperationException($"Mã giảm giá \"{promoCode}\" đã tồn tại.");
            }
        }

        private sealed class NormalizedPromotionRequest {
            public string PromoCode { get; set; } = string.Empty;
            public string DiscountType { get; set; } = string.Empty;
            public decimal DiscountValue { get; set; }
            public DateTime? ValidFromUtc { get; set; }
            public DateTime? ValidToUtc { get; set; }
        }
    }
}
