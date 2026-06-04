using System.Globalization;

namespace HuongVanTra.Service.Sales {
    /// <summary>Ghi nhận VA SePay trên Order.Notes để webhook khớp theo subAccount.</summary>
    public static class SepayOrderNotes {
        public const string VaPrefix = "SEPAY_VA:";
        public const string OidPrefix = "SEPAY_OID:";
        public const string AmountPrefix = "SEPAY_AMT:";
        public const string QrAtPrefix = "SEPAY_QR_AT:";
        public const string ExpPrefix = "SEPAY_QR_EXP:";

        public sealed class Parsed {
            public string VaNumber { get; init; } = string.Empty;
            public string? SepayOrderId { get; init; }
            public decimal? LockedAmount { get; init; }
            public DateTime? QrGeneratedAt { get; init; }
            public DateTime? QrExpiresAt { get; init; }
        }

        public static string Build(
            string vaNumber,
            decimal amount,
            string? sepayOrderId = null,
            int vaDurationSeconds = 86400) {
            var va = NormalizeDigits(vaNumber);
            var now = DateTime.UtcNow;
            var duration = vaDurationSeconds > 0 ? vaDurationSeconds : 86400;
            var note =
                $"{VaPrefix}{va};{AmountPrefix}{Math.Round(amount, 0, MidpointRounding.AwayFromZero)};{QrAtPrefix}{now:O};{ExpPrefix}{now.AddSeconds(duration):O}";
            if (!string.IsNullOrWhiteSpace(sepayOrderId)) {
                note += $";{OidPrefix}{sepayOrderId.Trim()}";
            }

            return note;
        }

        public static Parsed? TryParse(string? notes) {
            if (string.IsNullOrWhiteSpace(notes) || !notes.Contains(VaPrefix, StringComparison.OrdinalIgnoreCase)) {
                return null;
            }

            var va = ExtractToken(notes, VaPrefix);
            if (string.IsNullOrWhiteSpace(va)) {
                return null;
            }

            decimal? amount = null;
            var amountRaw = ExtractToken(notes, AmountPrefix);
            if (!string.IsNullOrWhiteSpace(amountRaw)
                && decimal.TryParse(amountRaw, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsedAmount)) {
                amount = parsedAmount;
            }

            DateTime? qrAt = null;
            var atRaw = ExtractToken(notes, QrAtPrefix);
            if (!string.IsNullOrWhiteSpace(atRaw)
                && DateTime.TryParse(atRaw, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsedAt)) {
                qrAt = parsedAt;
            }

            DateTime? qrExp = null;
            var expRaw = ExtractToken(notes, ExpPrefix);
            if (!string.IsNullOrWhiteSpace(expRaw)
                && DateTime.TryParse(expRaw, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsedExp)) {
                qrExp = parsedExp;
            }

            var oid = ExtractToken(notes, OidPrefix);

            return new Parsed {
                VaNumber = va,
                SepayOrderId = string.IsNullOrWhiteSpace(oid) ? null : oid,
                LockedAmount = amount,
                QrGeneratedAt = qrAt,
                QrExpiresAt = qrExp,
            };
        }

        public static bool IsQrExpired(Parsed parsed) =>
            parsed.QrExpiresAt.HasValue && DateTime.UtcNow >= parsed.QrExpiresAt.Value;

        public static bool CanReuseVa(Parsed parsed, decimal currentTotal) {
            if (!parsed.LockedAmount.HasValue
                || parsed.LockedAmount.Value != Math.Round(currentTotal, 0, MidpointRounding.AwayFromZero)) {
                return false;
            }

            return !IsQrExpired(parsed);
        }

        /// <summary>Xóa metadata VA/QR; giữ phần ghi chú khác (nếu có).</summary>
        public static string? StripPaymentMetadata(string? notes) {
            if (string.IsNullOrWhiteSpace(notes)) {
                return null;
            }

            var parts = notes.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(p => !p.StartsWith("SEPAY_", StringComparison.OrdinalIgnoreCase))
                .ToList();

            return parts.Count == 0 ? null : string.Join("; ", parts);
        }

        public static bool ContainsVa(string? notes, string vaNumber) {
            if (string.IsNullOrWhiteSpace(notes) || string.IsNullOrWhiteSpace(vaNumber)) {
                return false;
            }

            return notes.Contains($"{VaPrefix}{NormalizeDigits(vaNumber)}", StringComparison.OrdinalIgnoreCase);
        }

        public static string NormalizeDigits(string value) {
            return new string(value.Where(char.IsLetterOrDigit).ToArray());
        }

        private static string? ExtractToken(string notes, string prefix) {
            var start = notes.IndexOf(prefix, StringComparison.OrdinalIgnoreCase);
            if (start < 0) {
                return null;
            }

            start += prefix.Length;
            var end = notes.IndexOf(';', start);
            if (end < 0) {
                end = notes.Length;
            }

            return notes[start..end].Trim();
        }
    }
}
