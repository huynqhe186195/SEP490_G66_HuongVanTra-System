using ProductService.Domain.Enums;

namespace ProductService.Application.Validation;

public static class ProductCapabilityRules
{
    public static ProductVariantCapabilities Resolve(
        ProductType productType,
        bool? isPurchasable,
        bool? canBeBomComponent,
        bool? canUseInCustom,
        bool? canHaveBom) => productType switch
    {
        ProductType.THANH_PHAM => new(
            IsPurchasable: isPurchasable ?? true,
            CanBeBomComponent: canBeBomComponent ?? false,
            CanUseInCustom: canUseInCustom ?? false,
            CanHaveBom: canHaveBom ?? true),
        ProductType.NGUYEN_LIEU or ProductType.BAO_BI => new(
            IsPurchasable: isPurchasable ?? true,
            CanBeBomComponent: canBeBomComponent ?? true,
            CanUseInCustom: canUseInCustom ?? false,
            CanHaveBom: false),
        _ => new(false, false, false, false)
    };
}

public sealed record ProductVariantCapabilities(
    bool IsPurchasable,
    bool CanBeBomComponent,
    bool CanUseInCustom,
    bool CanHaveBom);
