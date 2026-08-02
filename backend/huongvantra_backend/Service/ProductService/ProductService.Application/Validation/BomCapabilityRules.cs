using ProductService.Domain.Enums;

namespace ProductService.Application.Validation;

public static class BomCapabilityRules
{
    public static bool CanOwnBom(ProductType productType, bool canHaveBom, bool isActive) =>
        productType == ProductType.THANH_PHAM && canHaveBom && isActive;

    public static bool CanBeComponent(ProductType productType, bool canBeBomComponent, bool isActive) =>
        productType is ProductType.NGUYEN_LIEU or ProductType.BAO_BI or ProductType.THANH_PHAM
        && canBeBomComponent
        && isActive;
}
