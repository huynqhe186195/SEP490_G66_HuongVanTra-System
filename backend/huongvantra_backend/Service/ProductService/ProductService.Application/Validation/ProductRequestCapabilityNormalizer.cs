using ProductService.Application.DTOs.Requests;
using ProductService.Domain.Enums;

namespace ProductService.Application.Validation;

public static class ProductRequestCapabilityNormalizer
{
    public static CreateProductRequest Normalize(CreateProductRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        var productType = ResolveProductType(request.ProductType);
        var variants = request.Variants ?? [];
        var baseIndex = variants.FindIndex(variant => variant.IsBaseUnitVariant == true);
        if (baseIndex < 0 && variants.Count > 0) baseIndex = 0;

        return request with
        {
            Variants = variants
                .Select((variant, index) => NormalizeVariant(variant, productType, index == baseIndex))
                .ToList(),
            VariantGenerator = NormalizeVariantGenerator(request.VariantGenerator, productType)
        };
    }

    private static ProductVariantRequest NormalizeVariant(
        ProductVariantRequest variant,
        ProductType productType,
        bool isBaseUnitVariant)
    {
        var capabilities = ProductCapabilityRules.Resolve(
            productType,
            variant.IsPurchasable,
            variant.CanBeBomComponent,
            variant.CanUseInCustom,
            variant.CanHaveBom);

        return variant with
        {
            IsPurchasable = capabilities.IsPurchasable,
            CanBeBomComponent = capabilities.CanBeBomComponent,
            CanUseInCustom = capabilities.CanUseInCustom,
            CanHaveBom = capabilities.CanHaveBom,
            // A client may author only the base operational BOM. Derived BOM is
            // regenerated atomically by ProductLogic/DerivedBomGenerator.
            BomLines = isBaseUnitVariant
                ? variant.BomLines?.Where(line => !line.IsRequiredBaseComponent).ToList()
                : []
        };
    }

    private static GenerateProductVariantsRequest? NormalizeVariantGenerator(
        GenerateProductVariantsRequest? generator,
        ProductType productType)
    {
        if (generator is null) return null;

        var capabilities = ProductCapabilityRules.Resolve(
            productType,
            generator.IsPurchasable,
            generator.CanBeBomComponent,
            generator.CanUseInCustom,
            generator.CanHaveBom);

        return generator with
        {
            IsPurchasable = capabilities.IsPurchasable,
            CanBeBomComponent = capabilities.CanBeBomComponent,
            CanUseInCustom = capabilities.CanUseInCustom,
            CanHaveBom = capabilities.CanHaveBom
        };
    }

    private static ProductType ResolveProductType(string? value)
    {
        if (ProductTypeValidation.TryParseDefined(value, out var productType))
        {
            return productType;
        }

        return (ProductType)(-1);
    }
}
