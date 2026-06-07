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

    [Fact]
    public void ValidatePagination_RejectsPageSizeOver100()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidatePagination(1, 101));
        Assert.Contains(ex.Errors, e => e.Contains("PageSize tối đa là 100"));
    }

    [Fact]
    public void ValidatePagination_AcceptsPageSize100()
    {
        ProductInputValidator.ValidatePagination(1, 100);
    }

    [Fact]
    public void ValidateProductSku_RejectsInvalidSkuCode()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateProductSku(
            Guid.NewGuid(), "ab", "Gói 100g", 100, 1000m, null));
        Assert.Contains(ex.Errors, e => e.Contains("Mã SKU"));
    }

    [Theory]
    [InlineData("TEA-001")]
    [InlineData("CF_500G")]
    [InlineData("ABC123")]
    public void ValidateProductSku_AcceptsValidSkuCode(string code)
    {
        var result = ProductInputValidator.ValidateProductSku(
            Guid.NewGuid(), code, "Gói 100g", 100, 1000m, null);
        Assert.Equal(code, result.SkuCode);
    }

    [Fact]
    public void ValidateProductSku_UppercasesSkuCode()
    {
        var result = ProductInputValidator.ValidateProductSku(
            Guid.NewGuid(), "tea-001", "Gói 100g", 100, 1000m, null);
        Assert.Equal("TEA-001", result.SkuCode);
    }

    [Fact]
    public void ValidateProductSku_RejectsZeroPrice()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateProductSku(
            Guid.NewGuid(), "TEA-001", "Gói 100g", 100, 0m, null));
        Assert.Contains(ex.Errors, e => e.Contains("Giá bán"));
    }

    [Fact]
    public void ValidateProductSku_RejectsPriceOverMax()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateProductSku(
            Guid.NewGuid(), "TEA-001", "Gói 100g", 100, 1_000_000_001m, null));
        Assert.Contains(ex.Errors, e => e.Contains("Giá bán"));
    }

    [Fact]
    public void ValidateProductSku_RejectsMoreThanTwoDecimalPlaces()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateProductSku(
            Guid.NewGuid(), "TEA-001", "Gói 100g", 100, 100.123m, null));
        Assert.Contains(ex.Errors, e => e.Contains("2 chữ số thập phân"));
    }

    [Fact]
    public void ValidateProductSku_AcceptsTwoDecimalPlaces()
    {
        var result = ProductInputValidator.ValidateProductSku(
            Guid.NewGuid(), "TEA-001", "Gói 100g", 100, 100.25m, null);
        Assert.Equal(100.25m, result.BasePrice);
    }

    [Fact]
    public void ValidateProductSku_RejectsZeroWeight()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateProductSku(
            Guid.NewGuid(), "TEA-001", "Gói 100g", 0, 1000m, null));
        Assert.Contains(ex.Errors, e => e.Contains("Khối lượng"));
    }

    [Fact]
    public void ValidateProductSku_RejectsWeightOverMax()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateProductSku(
            Guid.NewGuid(), "TEA-001", "Gói 100g", 100_001, 1000m, null));
        Assert.Contains(ex.Errors, e => e.Contains("Khối lượng"));
    }

    [Fact]
    public void ValidateProductSku_AcceptsMaxWeight()
    {
        var result = ProductInputValidator.ValidateProductSku(
            Guid.NewGuid(), "TEA-001", "Gói 100g", 100_000, 1000m, null);
        Assert.Equal(100_000, result.WeightInGrams);
    }

    [Fact]
    public void ValidateProductSku_RejectsInvalidImageUrl()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateProductSku(
            Guid.NewGuid(), "TEA-001", "Gói 100g", 100, 1000m, "ftp://bad.com/a.jpg"));
        Assert.Contains(ex.Errors, e => e.Contains("URL ảnh"));
    }

    [Theory]
    [InlineData("http://example.com/a.jpg")]
    [InlineData("https://cdn.example.com/tea.png")]
    public void ValidateProductSku_AcceptsHttpHttpsImageUrl(string url)
    {
        var result = ProductInputValidator.ValidateProductSku(
            Guid.NewGuid(), "TEA-001", "Gói 100g", 100, 1000m, url);
        Assert.Equal(url, result.ImageUrl);
    }

    [Fact]
    public void ValidateProductSku_ReturnsMultipleErrors()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateProductSku(
            Guid.NewGuid(), "x", "", 0, 0m, "not-a-url"));
        Assert.True(ex.Errors.Count >= 3);
    }

    [Fact]
    public void ValidateCategory_RejectsEmptyName()
    {
        var ex = AssertValidation(() => ProductInputValidator.ValidateCategory("", null, null));
        Assert.Contains(ex.Errors, e => e.Contains("Tên danh mục"));
    }
}
