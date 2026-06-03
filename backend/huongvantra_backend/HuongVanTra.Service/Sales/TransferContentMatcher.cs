using System.Text.RegularExpressions;

namespace HuongVanTra.Service.Sales {
    /// <summary>Trích mã đơn từ nội dung CK / field code của SePay.</summary>
    public static class TransferContentMatcher {
        private static readonly Regex OrderCodePattern = new(
            @"POS-\d{14}-[A-Z0-9]{6}|ONL-\d{14}-[A-Z0-9]{6}|ORD-\d{14}-[A-Z0-9]{6}",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        public static string? ExtractOrderCode(string? content, string? referenceCode, string? sepayCode) {
            if (!string.IsNullOrWhiteSpace(sepayCode)) {
                var fromSepay = NormalizeToken(sepayCode);
                if (IsOrderCodeShape(fromSepay)) {
                    return fromSepay;
                }
            }

            if (!string.IsNullOrWhiteSpace(content)) {
                var match = OrderCodePattern.Match(content);
                if (match.Success) {
                    return match.Value.ToUpperInvariant();
                }

                var upper = content.ToUpperInvariant();
                var posIndex = upper.IndexOf("POS-", StringComparison.Ordinal);
                if (posIndex >= 0) {
                    var token = TakeOrderToken(upper[posIndex..]);
                    if (!string.IsNullOrWhiteSpace(token)) {
                        return token;
                    }
                }

                if (upper.StartsWith("POS ", StringComparison.Ordinal) && upper.Length > 4) {
                    var afterPos = TakeOrderToken(upper[4..].Trim());
                    if (!string.IsNullOrWhiteSpace(afterPos)) {
                        return afterPos;
                    }
                }
            }

            if (!string.IsNullOrWhiteSpace(referenceCode)) {
                var refToken = NormalizeToken(referenceCode);
                if (IsOrderCodeShape(refToken)) {
                    return refToken;
                }
            }

            return null;
        }

        public static string NormalizeMatchKey(string value) {
            return new string(value.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        }

        private static string? TakeOrderToken(string slice) {
            var token = new string(slice.TakeWhile(ch => char.IsLetterOrDigit(ch) || ch == '-').ToArray());
            return string.IsNullOrWhiteSpace(token) ? null : token.ToUpperInvariant();
        }

        private static string NormalizeToken(string value) {
            return value.Trim().ToUpperInvariant();
        }

        private static bool IsOrderCodeShape(string value) {
            return value.StartsWith("POS-", StringComparison.Ordinal)
                || value.StartsWith("ONL-", StringComparison.Ordinal)
                || value.StartsWith("ORD-", StringComparison.Ordinal);
        }
    }
}
