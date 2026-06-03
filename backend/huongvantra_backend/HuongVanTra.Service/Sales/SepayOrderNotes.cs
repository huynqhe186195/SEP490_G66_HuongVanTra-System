namespace HuongVanTra.Service.Sales {
    /// <summary>Ghi nhận VA SePay trên Order.Notes để webhook khớp theo subAccount.</summary>
    public static class SepayOrderNotes {
        public const string VaPrefix = "SEPAY_VA:";

        public static string Build(string vaNumber, string? sepayOrderId = null) {
            var va = NormalizeDigits(vaNumber);
            var note = $"{VaPrefix}{va}";
            if (!string.IsNullOrWhiteSpace(sepayOrderId)) {
                note += $";SEPAY_OID:{sepayOrderId.Trim()}";
            }

            return note;
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
    }
}
