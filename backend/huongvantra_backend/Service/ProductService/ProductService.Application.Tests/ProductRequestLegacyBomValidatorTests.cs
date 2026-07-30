using ProductService.Application.DTOs.Requests;
using ProductService.Application.Validation;
using ProductService.Domain.Enums;
using ProductService.Domain.Exceptions;
using Xunit;

namespace ProductService.Application.Tests;

public sealed class ProductRequestLegacyBomValidatorTests
{
    [Fact]
    public void RejectLegacyRequiredBaseComponents_TrueFlag_RejectsRawClientPayload()
    {
        var request = ProductWithBomLine(isRequiredBaseComponent: true);

        var exception = Assert.Throws<ProductValidationException>(
            () => ProductRequestLegacyBomValidator.RejectLegacyRequiredBaseComponents(request));

        Assert.Contains(exception.Errors, error => error.Contains("IsRequiredBaseComponent"));
    }

    [Fact]
    public void RejectLegacyRequiredBaseComponents_FalseFlag_AllowsNormalBom()
    {
        var request = ProductWithBomLine(isRequiredBaseComponent: false);

        ProductRequestLegacyBomValidator.RejectLegacyRequiredBaseComponents(request);
    }

    private static CreateProductRequest ProductWithBomLine(bool isRequiredBaseComponent) => new(
        1, "Thành phẩm test", null, null, null, null, "Cái", "Piece", null, null, true,
        ProductType.THANH_PHAM.ToString(), [], [],
        [new ProductVariantRequest(
            "TP-TEST", "tp-test", null, "Thành phẩm test", "{}", 0m, 1m, null, null,
            true, true, true, null, [],
            [new BomLineRequest(Guid.NewGuid(), 1m, IsRequiredBaseComponent: isRequiredBaseComponent)])],
        null);
}
