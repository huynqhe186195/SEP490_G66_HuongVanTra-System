using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Enums;
using ProductService.Infrastructure.Data;
using ProductService.Infrastructure.UseCases;
using Xunit;

namespace ProductService.Application.Tests;

public sealed class ProductRetailPriceHistoryTests
{
    private static ProductDbContext NewDb() =>
        new(new DbContextOptionsBuilder<ProductDbContext>()
            .UseInMemoryDatabase($"retail-history-{Guid.NewGuid():N}")
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static ProductVariant SeedVariant(ProductDbContext db)
    {
        var category = new Category { Id = 1, Name = "Test" };
        var product = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = category.Id,
            Category = category,
            Name = "Trà test",
            ProductType = ProductType.THANH_PHAM,
            InventoryUnit = InventoryUnit.Piece
        };
        var variant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            Product = product,
            SkuCode = "SKU-PRICE-HISTORY",
            VariantName = "Gói",
            UnitName = "gói",
            CostPrice = 80_000m,
            RetailPrice = 100_000m,
            IsActive = true
        };
        db.Categories.Add(category);
        db.Products.Add(product);
        db.ProductVariants.Add(variant);
        db.SaveChanges();
        return variant;
    }

    [Fact]
    public async Task UpdateRetailPrice_CreatesDurableHistory_WithoutChangingCostPrice()
    {
        using var db = NewDb();
        var variant = SeedVariant(db);
        var logic = new ProductSkuLogic(null!, db);
        var actor = new ProductApprovalActorSnapshot(Guid.NewGuid(), "Admin Test", "Admin");

        await logic.UpdateRetailPriceAsync(
            variant.Id,
            new UpdateProductVariantRetailPriceRequest(120_000m),
            actor);

        var stored = await db.ProductVariants.SingleAsync(item => item.Id == variant.Id);
        var history = await db.ProductRetailPriceHistories.SingleAsync();
        Assert.Equal(80_000m, stored.CostPrice);
        Assert.Equal(120_000m, stored.RetailPrice);
        Assert.Equal(100_000m, history.OldRetailPrice);
        Assert.Equal(120_000m, history.NewRetailPrice);
        Assert.Equal(RetailPriceHistoryFactory.SourceManualAccounting, history.SourceType);
        Assert.Equal("Admin Test", history.ChangedByName);
    }

    [Fact]
    public async Task UpdateRetailPrice_WithSameValue_DoesNotCreateHistory()
    {
        using var db = NewDb();
        var variant = SeedVariant(db);
        var logic = new ProductSkuLogic(null!, db);
        var actor = new ProductApprovalActorSnapshot(Guid.NewGuid(), "Admin Test", "Admin");

        await logic.UpdateRetailPriceAsync(
            variant.Id,
            new UpdateProductVariantRetailPriceRequest(100_000m),
            actor);

        Assert.Empty(await db.ProductRetailPriceHistories.ToListAsync());
        Assert.Equal(80_000m, (await db.ProductVariants.SingleAsync()).CostPrice);
    }

    [Fact]
    public async Task UpdateRetailPrice_Twice_AppendsHistory_WithoutOverwritingOlderRows()
    {
        using var db = NewDb();
        var variant = SeedVariant(db);
        var logic = new ProductSkuLogic(null!, db);
        var actor = new ProductApprovalActorSnapshot(Guid.NewGuid(), "Kế toán Test", "Accountant");

        await logic.UpdateRetailPriceAsync(
            variant.Id,
            new UpdateProductVariantRetailPriceRequest(120_000m),
            actor);
        await logic.UpdateRetailPriceAsync(
            variant.Id,
            new UpdateProductVariantRetailPriceRequest(150_000m),
            actor);

        var histories = await db.ProductRetailPriceHistories
            .OrderBy(item => item.ChangedAt)
            .ThenBy(item => item.OldRetailPrice)
            .ToListAsync();

        Assert.Equal(2, histories.Count);
        Assert.Equal(100_000m, histories[0].OldRetailPrice);
        Assert.Equal(120_000m, histories[0].NewRetailPrice);
        Assert.Equal(120_000m, histories[1].OldRetailPrice);
        Assert.Equal(150_000m, histories[1].NewRetailPrice);
        Assert.Equal(150_000m, (await db.ProductVariants.SingleAsync()).RetailPrice);
    }

    [Fact]
    public void TryCreate_ReturnsNull_WhenPricesEqualAfterRounding()
    {
        var history = RetailPriceHistoryFactory.TryCreate(
            Guid.NewGuid(),
            100_000m,
            100_000.004m,
            Guid.NewGuid(),
            "Tester",
            RetailPriceHistoryFactory.SourceProductCatalogUpdate);

        Assert.Null(history);
    }

    [Fact]
    public void TryCreate_BuildsCatalogHistory_WhenPriceChanges()
    {
        var skuId = Guid.NewGuid();
        var history = RetailPriceHistoryFactory.TryCreate(
            skuId,
            100_000m,
            110_000m,
            null,
            null,
            RetailPriceHistoryFactory.SourceProductCatalogUpdate);

        Assert.NotNull(history);
        Assert.Equal(skuId, history!.SkuId);
        Assert.Equal(100_000m, history.OldRetailPrice);
        Assert.Equal(110_000m, history.NewRetailPrice);
        Assert.Equal(RetailPriceHistoryFactory.SourceProductCatalogUpdate, history.SourceType);
    }
}
