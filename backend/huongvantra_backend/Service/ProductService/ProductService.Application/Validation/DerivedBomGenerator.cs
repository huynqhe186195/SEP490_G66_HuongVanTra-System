using ProductService.Domain.Entities;

namespace ProductService.Application.Validation;

public static class DerivedBomGenerator
{
    public static List<ProductVariantBomLine> Generate(ProductVariant baseVariant, ProductVariant derivedVariant) =>
        Generate(baseVariant.BomLines, derivedVariant);

    public static List<ProductVariantBomLine> Generate(
        IEnumerable<ProductVariantBomLine> baseBomLines,
        ProductVariant derivedVariant) =>
        baseBomLines
            .Where(line => !line.IsDeleted && !line.IsRequiredBaseComponent)
            .Select(line => new ProductVariantBomLine
            {
                ProductVariantId = derivedVariant.Id,
                MaterialId = line.MaterialId,
                ComponentVariantId = line.ComponentVariantId,
                Quantity = line.Quantity * derivedVariant.ConversionRate,
                IsRequiredBaseComponent = false
            })
            .ToList();
}
