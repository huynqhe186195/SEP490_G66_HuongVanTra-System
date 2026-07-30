using ProductService.Application.DTOs.Requests;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.Validation;

public static class ProductRequestLegacyBomValidator
{
    public static void RejectLegacyRequiredBaseComponents(CreateProductRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.Variants?.Any(variant =>
                variant.BomLines?.Any(line => line.IsRequiredBaseComponent) == true) == true)
        {
            throw new ProductValidationException(
                "IsRequiredBaseComponent là trường legacy và không được phép sử dụng trong BOM mới.");
        }
    }
}
