using ProductService.Application.Validation;
using ProductService.Domain.Exceptions;
using Xunit;

namespace ProductService.Application.Tests;

public class ProductInputValidatorTests
{
    private static ProductValidationException AssertValidation(Action action)
    {
        var ex = Assert.Throws<ProductValidationException>(action);
        Assert.NotEmpty(ex.Errors);
        return ex;
    }

    private static VariantInput Variant(
        string? skuCode = "TEA-001",
        string? variantName = "Goi 100g",
        decimal costPrice = 100m,
        decimal retailPrice = 1000m,
        int? minStock = null,
        int? maxStock = null,
        bool isSellable = true,
        string? imageUrl = null)
    {
        return new VariantInput
        {
            SkuCode = skuCode,
            Barcode = (string?)null,
            VariantName = variantName,
            OptionValuesJson = "{}",
            CostPrice = costPrice,
            RetailPrice = retailPrice,
            MinStock = minStock,
            MaxStock = maxStock,
            IsSellable = isSellable,
            AllowRewardPoints = true,
            IsActive = true,
            ImageUrl = imageUrl,
            Units = Array.Empty<object>(),
        };
    }

    [Fact]
    public void ValidatePagination_RejectsPageSizeOver100()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidatePagination(1, 101));
        Assert.Contains(ex.Errors, e => e.Contains("PageSize"));
    }

    [Fact]
    public void ValidatePagination_AcceptsPageSize100()
    {
        ProductInputValidator.ValidatePagination(1, 100);
    }

    [Fact]
    public void ValidateVariants_RejectsInvalidSkuCode()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateVariants([Variant(skuCode: "ab")]));

        Assert.Contains(ex.Errors, e => e.Contains("SKU"));
    }

    [Theory]
    [InlineData("TEA-001")]
    [InlineData("CF_500G")]
    [InlineData("ABC123")]
    public void ValidateVariants_AcceptsValidSkuCode(string code)
    {
        var result = ProductInputValidator.ValidateVariants([Variant(skuCode: code)]);

        Assert.Equal(code, result[0].SkuCode);
    }

    [Fact]
    public void ValidateVariants_UppercasesSkuCode()
    {
        var result = ProductInputValidator.ValidateVariants([Variant(skuCode: "tea-001")]);

        Assert.Equal("TEA-001", result[0].SkuCode);
    }

    [Fact]
    public void ValidateVariants_RejectsZeroRetailPriceForSellableSku()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateVariants([Variant(retailPrice: 0m)]));

        Assert.NotEmpty(ex.Errors);
    }

    [Fact]
    public void ValidateVariants_RejectsPriceOverMax()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateVariants([Variant(retailPrice: 1_000_000_001m)]));

        Assert.Contains(ex.Errors, e => e.Contains("1,000,000,000"));
    }

    [Fact]
    public void ValidateVariants_RejectsMoreThanTwoDecimalPlaces()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateVariants([Variant(retailPrice: 100.123m)]));

        Assert.NotEmpty(ex.Errors);
    }

    [Fact]
    public void ValidateVariants_AcceptsTwoDecimalPlaces()
    {
        var result = ProductInputValidator.ValidateVariants([Variant(retailPrice: 100.25m)]);

        Assert.Equal(100.25m, result[0].RetailPrice);
    }

    [Fact]
    public void ValidateVariants_RejectsInvalidImageUrl()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateVariants([Variant(imageUrl: "ftp://bad.com/a.jpg")]));

        Assert.Contains(ex.Errors, e => e.Contains("URL"));
    }

    [Theory]
    [InlineData("http://example.com/a.jpg")]
    [InlineData("https://cdn.example.com/tea.png")]
    public void ValidateVariants_AcceptsHttpHttpsImageUrl(string url)
    {
        var result = ProductInputValidator.ValidateVariants([Variant(imageUrl: url)]);

        Assert.Equal(url, result[0].ImageUrl);
    }

    [Fact]
    public void ValidateVariants_RejectsInvalidStockRange()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateVariants([Variant(minStock: 10, maxStock: 5)]));

        Assert.NotEmpty(ex.Errors);
    }

    [Fact]
    public void ValidateVariants_RejectsDuplicateSkuCodes()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateVariants([
            Variant(skuCode: "TEA-001"),
            Variant(skuCode: "tea-001"),
        ]));

        Assert.Contains(ex.Errors, e => e.Contains("SKU"));
    }

    [Fact]
    public void ValidateVariants_ReturnsMultipleErrors()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateVariants([
            Variant(skuCode: "x", variantName: "", retailPrice: 0m, imageUrl: "not-a-url"),
        ]));

        Assert.True(ex.Errors.Count >= 3);
    }

    [Fact]
    public void ValidateCategory_RejectsEmptyName()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateCategory("", null, null));

        Assert.Contains(ex.Errors, e => e.Contains("danh"));
    }
}

public sealed class VariantInput
{
    public string? SkuCode { get; set; }
    public string? Barcode { get; set; }
    public string? VariantName { get; set; }
    public string? OptionValuesJson { get; set; }
    public decimal CostPrice { get; set; }
    public decimal RetailPrice { get; set; }
    public int? MinStock { get; set; }
    public int? MaxStock { get; set; }
    public bool IsSellable { get; set; }
    public bool AllowRewardPoints { get; set; }
    public bool IsActive { get; set; }
    public string? ImageUrl { get; set; }
    public object[] Units { get; set; } = [];
}
