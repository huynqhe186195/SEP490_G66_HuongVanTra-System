using ProductService.Domain.Enums;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.Validation;

public static class InventoryUnitConverter
{
    public static InventoryUnit ParseOrInfer(string? value, string? baseUnit, string? weightUnit)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            var normalized = BomUnitRules.NormalizeUnit(value);
            if (normalized is "gram" or "grams" or "g" or "kg")
                return InventoryUnit.Gram;

            if (normalized is "piece" or "pieces" or "unit" or "units" or "cai" or "chiec")
                return InventoryUnit.Piece;

            if (Enum.TryParse<InventoryUnit>(value, ignoreCase: true, out var parsed))
                return parsed;

            throw new ProductValidationException("Đơn vị tồn chỉ hỗ trợ Gram hoặc Cái.");
        }

        return Infer(baseUnit, weightUnit);
    }

    public static InventoryUnit Infer(string? baseUnit, string? weightUnit)
    {
        if (IsGramUnit(baseUnit) || IsGramUnit(weightUnit))
            return InventoryUnit.Gram;

        return InventoryUnit.Piece;
    }

    public static int NormalizeQuantity(decimal quantity, InventoryUnit inventoryUnit, string? submittedUnit = null)
    {
        if (quantity <= 0)
            throw new ProductValidationException("Số lượng phải lớn hơn 0.");

        var normalized = quantity;
        if (inventoryUnit == InventoryUnit.Gram && BomUnitRules.NormalizeUnit(submittedUnit) == "kg")
            normalized *= 1000m;

        if (normalized != decimal.Truncate(normalized))
            throw new ProductValidationException(
                inventoryUnit == InventoryUnit.Piece
                    ? "Số lượng tính theo cái phải là số nguyên."
                    : "Số lượng GRAM sau quy đổi phải là số nguyên.");

        if (normalized > int.MaxValue)
            throw new ProductValidationException("Số lượng vượt quá giới hạn cho phép.");

        return decimal.ToInt32(normalized);
    }

    public static string GetDisplayUnit(InventoryUnit inventoryUnit) =>
        inventoryUnit == InventoryUnit.Gram ? "g" : "cái";

    private static bool IsGramUnit(string? unit)
    {
        var normalized = BomUnitRules.NormalizeUnit(unit);
        return normalized is "g" or "gram" or "grams" or "kg";
    }
}
