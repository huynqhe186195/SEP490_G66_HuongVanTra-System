using System.Globalization;
using System.Text;

namespace ProductService.Application.Validation;

public static class BomUnitRules
{
    private static readonly HashSet<string> CountBasedUnits = new(StringComparer.OrdinalIgnoreCase)
    {
        "cai",
        "chiec",
        "hop",
        "tui",
        "tem",
        "nhan",
        "goi",
        "chai",
        "lo"
    };

    private static readonly HashSet<string> MeasureBasedUnits = new(StringComparer.OrdinalIgnoreCase)
    {
        "gram",
        "g",
        "kg",
        "ml",
        "lit",
        "l"
    };

    public static bool IsCountBasedUnit(string? unit) =>
        CountBasedUnits.Contains(NormalizeUnit(unit));

    public static bool IsMeasureBasedUnit(string? unit) =>
        MeasureBasedUnits.Contains(NormalizeUnit(unit));

    public static bool IsIntegerQuantity(decimal quantity) =>
        decimal.Truncate(quantity) == quantity;

    public static bool HasMaxDecimalPlaces(decimal quantity, int maxDecimalPlaces = 3) =>
        quantity == decimal.Round(quantity, maxDecimalPlaces, MidpointRounding.ToZero);

    public static string NormalizeUnit(string? unit)
    {
        if (string.IsNullOrWhiteSpace(unit)) return string.Empty;

        var normalized = unit.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);

        foreach (var character in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
                continue;

            if (char.IsLetterOrDigit(character))
                builder.Append(character);
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }
}
