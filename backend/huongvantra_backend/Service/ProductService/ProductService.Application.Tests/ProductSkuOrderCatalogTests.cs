using Microsoft.EntityFrameworkCore;
using ProductService.Domain.Entities;
using ProductService.Domain.Enums;
using ProductService.Infrastructure.Data;
using ProductService.Infrastructure.Repositories;
using ProductService.Infrastructure.UseCases;
using Xunit;

namespace ProductService.Application.Tests;

public class ProductSkuOrderCatalogTests
{
    [Fact]
    public async Task OrderCatalog_ReturnsOnlyActiveSellableSkusUnderActiveProducts()
    {
        await using var db = CreateDbContext();
        var activeProduct = CreateProduct(isActive: true);
        var inactiveProduct = CreateProduct(isActive: false);
        var validSku = CreateVariant(activeProduct, "VALID", isActive: true, isSellable: true);
        var inactiveSku = CreateVariant(activeProduct, "INACTIVE", isActive: false, isSellable: true);
        var nonSellableSku = CreateVariant(activeProduct, "NONSELLABLE", isActive: true, isSellable: false);
        var inactiveProductSku = CreateVariant(inactiveProduct, "PARENT-INACTIVE", isActive: true, isSellable: true);

        db.Products.AddRange(activeProduct, inactiveProduct);
        db.ProductVariants.AddRange(validSku, inactiveSku, nonSellableSku, inactiveProductSku);
        await db.SaveChangesAsync();

        var logic = new ProductSkuLogic(new ProductRepository(db), db);
        var result = await logic.GetOrderCatalogBySkuIdsAsync(
            [validSku.Id, inactiveSku.Id, nonSellableSku.Id, inactiveProductSku.Id]);

        var profile = Assert.Single(result);
        Assert.Equal(validSku.Id, profile.SkuId);
        Assert.Equal(activeProduct.CategoryId, profile.CategoryId);
        Assert.Equal(InventoryUnit.Gram.ToString(), profile.InventoryUnit);
        Assert.DoesNotContain(result, item => item.SkuId == inactiveSku.Id);
        Assert.DoesNotContain(result, item => item.SkuId == nonSellableSku.Id);
        Assert.DoesNotContain(result, item => item.SkuId == inactiveProductSku.Id);
    }

    [Fact]
    public async Task OrderCatalog_ExcludesInactiveSku()
    {
        await AssertSkuExcludedAsync(productIsActive: true, skuIsActive: false, skuIsSellable: true);
    }

    [Fact]
    public async Task OrderCatalog_ExcludesNonSellableSku()
    {
        await AssertSkuExcludedAsync(productIsActive: true, skuIsActive: true, skuIsSellable: false);
    }

    [Fact]
    public async Task OrderCatalog_ExcludesSkuUnderInactiveProduct()
    {
        await AssertSkuExcludedAsync(productIsActive: false, skuIsActive: true, skuIsSellable: true);
    }

    private static async Task AssertSkuExcludedAsync(
        bool productIsActive,
        bool skuIsActive,
        bool skuIsSellable)
    {
        await using var db = CreateDbContext();
        var product = CreateProduct(productIsActive);
        var sku = CreateVariant(product, "UNAVAILABLE", skuIsActive, skuIsSellable);
        db.Products.Add(product);
        db.ProductVariants.Add(sku);
        await db.SaveChangesAsync();

        var logic = new ProductSkuLogic(new ProductRepository(db), db);
        var result = await logic.GetOrderCatalogBySkuIdsAsync([sku.Id]);

        Assert.Empty(result);
    }

    private static ProductDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ProductDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ProductDbContext(options);
    }

    private static Product CreateProduct(bool isActive) =>
        new()
        {
            Id = Guid.NewGuid(),
            CategoryId = 9701,
            Name = "Order catalog test product",
            ProductType = ProductType.NGUYEN_LIEU,
            InventoryUnit = InventoryUnit.Gram,
            BaseUnit = "g",
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow,
        };

    private static ProductVariant CreateVariant(
        Product product,
        string suffix,
        bool isActive,
        bool isSellable) =>
        new()
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            Product = product,
            SkuCode = $"ORDER-CATALOG-{suffix}-{Guid.NewGuid():N}",
            VariantName = suffix,
            IsActive = isActive,
            IsSellable = isSellable,
            CreatedAt = DateTime.UtcNow,
        };
}
