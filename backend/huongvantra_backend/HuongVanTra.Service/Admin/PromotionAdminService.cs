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
                .OrderBy(p => p.PromoCode)
                .Select(p => new {
                    p.Id,
                    p.PromoCode,
                    p.DiscountType,
                    p.DiscountValue,
                    p.ValidFromUtc,
                    p.ValidToUtc,
                    OrderCount = p.Orders.Count,
                })
                .ToListAsync(cancellationToken);

            return items
                .Select(p => MapItem(p.Id, p.PromoCode, p.DiscountType, p.DiscountValue, p.ValidFromUtc, p.ValidToUtc, p.OrderCount))
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
                    OrderCount = p.Orders.Count,
                })
                .FirstOrDefaultAsync(cancellationToken);

            return item is null
                ? null
                : MapItem(item.Id, item.PromoCode, item.DiscountType, item.DiscountValue, item.ValidFromUtc, item.ValidToUtc, item.OrderCount);
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
            };

            _db.OrderPromotions.Add(entity);
            await _db.SaveChangesAsync(cancellationToken);

            return (await GetAsync(entity.Id, cancellationToken))!;
        }

        public async Task<PromotionAdminItemDto?> UpdateAsync(
            int id, UpsertPromotionRequest request, CancellationToken cancellationToken = default) {
            var entity = await _db.OrderPromotions.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
            if (entity is null) {
                return null;
            }

            var normalized = NormalizeRequest(request);
            await EnsureUniquePromoCodeAsync(normalized.PromoCode, excludeId: id, cancellationToken);

            entity.PromoCode     = normalized.PromoCode;
            entity.DiscountType  = normalized.DiscountType;
            entity.DiscountValue = normalized.DiscountValue;
            entity.ValidFromUtc  = normalized.ValidFromUtc;
            entity.ValidToUtc    = normalized.ValidToUtc;

            await _db.SaveChangesAsync(cancellationToken);
            return await GetAsync(id, cancellationToken);
        }

        public async Task DeleteAsync(int id, CancellationToken cancellationToken = default) {
            var entity = await _db.OrderPromotions
                .Include(p => p.Orders)
                .FirstOrDefaultAsync(p => p.Id == id, cancellationToken)
                ?? throw new ArgumentException("Mã giảm giá không tồn tại.");

            if (entity.Orders.Any()) {
                throw new InvalidOperationException(
                    $"Không thể xóa mã \"{entity.PromoCode}\" vì đã có {entity.Orders.Count} đơn sử dụng.");
            }

            _db.OrderPromotions.Remove(entity);
            await _db.SaveChangesAsync(cancellationToken);
        }

        private static PromotionAdminItemDto MapItem(
            int id,
            string promoCode,
            string discountType,
            decimal discountValue,
            DateTime? validFromUtc,
            DateTime? validToUtc,
            int orderCount) {
            return new PromotionAdminItemDto {
                Id             = id,
                PromoCode      = promoCode,
                DiscountType   = discountType,
                DiscountValue  = discountValue,
                ValidFromUtc   = validFromUtc,
                ValidToUtc     = validToUtc,
                ValidityStatus = PromotionValidity.GetStatus(validFromUtc, validToUtc),
                OrderCount     = orderCount,
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
                p => p.PromoCode.ToUpper() == promoCode && (!excludeId.HasValue || p.Id != excludeId.Value),
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
