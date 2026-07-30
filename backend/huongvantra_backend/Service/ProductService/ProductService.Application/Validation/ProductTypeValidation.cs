using ProductService.Domain.Enums;

namespace ProductService.Application.Validation;

public static class ProductTypeValidation
{
    public static bool TryParseDefined(string? value, out ProductType productType)
    {
        if (!string.IsNullOrWhiteSpace(value)
            && Enum.TryParse<ProductType>(value, ignoreCase: true, out productType)
            && Enum.IsDefined(typeof(ProductType), productType))
        {
            return true;
        }

        productType = default;
        return false;
    }
}
