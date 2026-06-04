using HuongVanTra.Core.Entities.Sales;

namespace HuongVanTra.Service.Sales {
    public static class PromotionValidity {
        public const string StatusActive = "active";
        public const string StatusNotStarted = "not_started";
        public const string StatusExpired = "expired";
        public const string StatusUnlimited = "unlimited";
        public const string StatusDeactivated = "deactivated";

        public static bool IsUsable(OrderPromotion promotion, DateTime? atUtc = null) {
            if (!promotion.IsActive) {
                return false;
            }

            return IsWithinDateRange(promotion.ValidFromUtc, promotion.ValidToUtc, atUtc);
        }

        public static bool IsWithinDateRange(DateTime? validFromUtc, DateTime? validToUtc, DateTime? atUtc = null) {
            var now = atUtc ?? DateTime.UtcNow;
            if (validFromUtc.HasValue && now < validFromUtc.Value) {
                return false;
            }

            if (validToUtc.HasValue && now > validToUtc.Value) {
                return false;
            }

            return true;
        }

        public static string GetDisplayStatus(OrderPromotion promotion, DateTime? atUtc = null) {
            if (!promotion.IsActive) {
                return StatusDeactivated;
            }

            return GetValidityStatus(promotion.ValidFromUtc, promotion.ValidToUtc, atUtc);
        }

        public static string GetValidityStatus(DateTime? validFromUtc, DateTime? validToUtc, DateTime? atUtc = null) {
            if (!validFromUtc.HasValue && !validToUtc.HasValue) {
                return StatusUnlimited;
            }

            var now = atUtc ?? DateTime.UtcNow;
            if (validFromUtc.HasValue && now < validFromUtc.Value) {
                return StatusNotStarted;
            }

            if (validToUtc.HasValue && now > validToUtc.Value) {
                return StatusExpired;
            }

            return StatusActive;
        }

        public static void EnsureUsable(OrderPromotion promotion, DateTime? atUtc = null) {
            if (!promotion.IsActive) {
                throw new InvalidOperationException("Mã giảm giá đã ngừng hoạt động.");
            }

            if (IsWithinDateRange(promotion.ValidFromUtc, promotion.ValidToUtc, atUtc)) {
                return;
            }

            var status = GetValidityStatus(promotion.ValidFromUtc, promotion.ValidToUtc, atUtc);
            throw status switch {
                StatusNotStarted => new InvalidOperationException("Mã giảm giá chưa có hiệu lực."),
                StatusExpired      => new InvalidOperationException("Mã giảm giá đã hết hạn."),
                _                  => new InvalidOperationException("Mã giảm giá không còn hiệu lực."),
            };
        }

        public static (DateTime? ValidFromUtc, DateTime? ValidToUtc) NormalizeValidityRange(
            DateOnly? validFrom,
            DateOnly? validTo) {
            if (validFrom.HasValue && validTo.HasValue && validFrom.Value > validTo.Value) {
                throw new ArgumentException("Ngày bắt đầu không được sau ngày kết thúc.");
            }

            return (ToVnStartUtc(validFrom), ToVnEndUtc(validTo));
        }

        private static DateTime? ToVnStartUtc(DateOnly? date) {
            if (!date.HasValue) {
                return null;
            }

            return DateTime.SpecifyKind(date.Value.ToDateTime(TimeOnly.MinValue).AddHours(-7), DateTimeKind.Utc);
        }

        private static DateTime? ToVnEndUtc(DateOnly? date) {
            if (!date.HasValue) {
                return null;
            }

            return DateTime.SpecifyKind(
                date.Value.ToDateTime(new TimeOnly(23, 59, 59)).AddHours(-7),
                DateTimeKind.Utc);
        }
    }
}
