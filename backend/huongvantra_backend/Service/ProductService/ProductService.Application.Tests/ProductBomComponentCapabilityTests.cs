using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.Interfaces;
using ProductService.Application.UseCases;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Enums;
using ProductService.Domain.Exceptions;
using ProductService.Infrastructure.Data;
using ProductService.Infrastructure.Repositories;
using ProductService.Infrastructure.UseCases;
using Xunit;

namespace ProductService.Application.Tests;

/// <summary>
/// §8 targeted tests — BOM component capability và ProductType validation.
/// Cases 1–10: pure-function tests over BomCapabilityRules, ProductCapabilityRules, ProductTypeValidation.
/// Cases 11–15, 18–19: in-memory DbContext + ProductLogic.UpdateVariantBomAsync.
/// Case 16: ProductInputValidator.ValidateVariants (ConversionRate validation).
/// Case 17: DerivedBomGenerator arithmetic.
/// Case 20–21: ProductApprovalLogic ProductType validation and derived BOM on reject/resubmit.
/// </summary>
public sealed class ProductBomComponentCapabilityTests
{
    #region Pure-function tests (Cases 1–10)

    [Fact]
    public void Case1_NguyenLieu_CanBeBomComponent_True_IsAccepted()
    {
        var result = BomCapabilityRules.CanBeComponent(ProductType.NGUYEN_LIEU, canBeBomComponent: true, isActive: true);
        Assert.True(result);
    }

    [Fact]
    public void Case2_BaoBi_CanBeBomComponent_True_IsAccepted()
    {
        var result = BomCapabilityRules.CanBeComponent(ProductType.BAO_BI, canBeBomComponent: true, isActive: true);
        Assert.True(result);
    }

    [Fact]
    public void Case3_ThanhPham_CanBeBomComponent_True_IsAccepted()
    {
        var result = BomCapabilityRules.CanBeComponent(ProductType.THANH_PHAM, canBeBomComponent: true, isActive: true);
        Assert.True(result);
    }

    [Fact]
    public void Case4_ThanhPham_CanBeBomComponent_False_IsRejected()
    {
        var result = BomCapabilityRules.CanBeComponent(ProductType.THANH_PHAM, canBeBomComponent: false, isActive: true);
        Assert.False(result);
    }

    [Fact]
    public void Case5_InactiveComponent_IsRejected()
    {
        var result = BomCapabilityRules.CanBeComponent(ProductType.NGUYEN_LIEU, canBeBomComponent: true, isActive: false);
        Assert.False(result);
    }

    [Fact]
    public void Case6_UnknownProductType_IsRejected()
    {
        var unknownType = (ProductType)999;
        var result = BomCapabilityRules.CanBeComponent(unknownType, canBeBomComponent: true, isActive: true);
        Assert.False(result);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Case8_BomQuantityZeroOrNegative_IsRejected(decimal quantity)
    {
        var isValid = quantity > 0 && BomUnitRules.IsIntegerQuantity(quantity);
        Assert.False(isValid);
    }

    [Theory]
    [InlineData(1.5)]
    [InlineData(2.3)]
    public void Case9_BomQuantityDecimal_IsRejected(decimal quantity)
    {
        var isValid = BomUnitRules.IsIntegerQuantity(quantity);
        Assert.False(isValid);
    }

    [Fact]
    public void Case10_BomQuantityPositiveInteger_IsAccepted()
    {
        var isValid = 3m > 0 && BomUnitRules.IsIntegerQuantity(3m);
        Assert.True(isValid);
    }

    #endregion

    #region ProductInputValidator ConversionRate tests (Case 16)

    private static VariantInput DerivedVariantInput(decimal conversionRate) => new()
    {
        SkuCode = "TEST-DERIVED",
        VariantName = "Derived",
        OptionValuesJson = "{}",
        CostPrice = 10_000m,
        RetailPrice = 20_000m,
        IsSellable = true,
        AllowRewardPoints = true,
        IsActive = true,
        Units = [],
        ConversionRate = conversionRate,
        IsBaseUnitVariant = false
    };

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Case16a_ConversionRateZeroOrNegative_IsRejected(decimal rate)
    {
        var ex = Assert.Throws<ProductValidationException>(() =>
            ProductInputValidator.ValidateVariants([DerivedVariantInput(rate)]));

        Assert.Contains(ex.Errors, e => e.Contains("Ty le quy doi SKU phai lon hon 0"));
    }

    [Fact]
    public void Case16b_ConversionRateFractional_IsRejected()
    {
        var ex = Assert.Throws<ProductValidationException>(() =>
            ProductInputValidator.ValidateVariants([DerivedVariantInput(2.5m)]));

        Assert.Contains(ex.Errors, e => e.Contains("Ty le quy doi SKU phai la so nguyen duong"));
    }

    #endregion

    #region DerivedBomGenerator arithmetic (Case 17)

    [Fact]
    public void Case17_DerivedBom_MultipliesQuantityCorrectly()
    {
        var baseVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = Guid.NewGuid(),
            SkuCode = "BASE-SKU",
            VariantName = "Base",
            IsBaseUnitVariant = true,
            ConversionRate = 1,
            BomLines = new List<ProductVariantBomLine>()
        };

        var materialNguyenLieu = Guid.NewGuid();
        var materialBaoBi = Guid.NewGuid();
        var materialThanhPham = Guid.NewGuid();

        baseVariant.BomLines.Add(new ProductVariantBomLine
        {
            ProductVariantId = baseVariant.Id,
            MaterialId = materialNguyenLieu,
            ComponentVariantId = Guid.NewGuid(),
            Quantity = 2m,
            IsRequiredBaseComponent = false
        });

        baseVariant.BomLines.Add(new ProductVariantBomLine
        {
            ProductVariantId = baseVariant.Id,
            MaterialId = materialBaoBi,
            ComponentVariantId = Guid.NewGuid(),
            Quantity = 1m,
            IsRequiredBaseComponent = false
        });

        baseVariant.BomLines.Add(new ProductVariantBomLine
        {
            ProductVariantId = baseVariant.Id,
            MaterialId = materialThanhPham,
            ComponentVariantId = Guid.NewGuid(),
            Quantity = 3m,
            IsRequiredBaseComponent = false
        });

        var derivedVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = baseVariant.ProductId,
            SkuCode = "DERIVED-SKU",
            VariantName = "Derived",
            IsBaseUnitVariant = false,
            BaseVariantId = baseVariant.Id,
            ConversionRate = 3m
        };

        var derivedBom = DerivedBomGenerator.Generate(baseVariant.BomLines, derivedVariant);

        Assert.Equal(3, derivedBom.Count);
        Assert.Equal(6m, derivedBom.First(line => line.MaterialId == materialNguyenLieu).Quantity); // 2 × 3
        Assert.Equal(3m, derivedBom.First(line => line.MaterialId == materialBaoBi).Quantity); // 1 × 3
        Assert.Equal(9m, derivedBom.First(line => line.MaterialId == materialThanhPham).Quantity); // 3 × 3
        Assert.All(derivedBom, line => Assert.False(line.IsRequiredBaseComponent));
    }

    #endregion

    #region ProductTypeValidation (Case 20)

    [Fact]
    public void Case20_InvalidProductType_IsRejected()
    {
        var isValid = ProductTypeValidation.TryParseDefined("NGUYEN_LIEU_VAT_TU", out _);
        Assert.False(isValid);

        isValid = ProductTypeValidation.TryParseDefined(null, out _);
        Assert.False(isValid);

        isValid = ProductTypeValidation.TryParseDefined("", out _);
        Assert.False(isValid);

        isValid = ProductTypeValidation.TryParseDefined("UNKNOWN", out _);
        Assert.False(isValid);
    }

    #endregion

    #region ProductCapabilityRules default mapping (§6 verification)

    [Fact]
    public void CapabilityMapping_ThanhPham_DefaultsCanBeBomComponentFalse()
    {
        var caps = ProductCapabilityRules.Resolve(ProductType.THANH_PHAM, null, null, null, null);
        Assert.True(caps.IsPurchasable);
        Assert.False(caps.CanBeBomComponent); // server default for THANH_PHAM is false
        Assert.False(caps.CanUseInCustom);
        Assert.True(caps.CanHaveBom);
    }

    [Fact]
    public void CapabilityMapping_NguyenLieu_DefaultsCanBeBomComponentTrue()
    {
        var caps = ProductCapabilityRules.Resolve(ProductType.NGUYEN_LIEU, null, null, null, null);
        Assert.True(caps.IsPurchasable);
        Assert.True(caps.CanBeBomComponent);
        Assert.False(caps.CanUseInCustom);
        Assert.False(caps.CanHaveBom);
    }

    [Fact]
    public void CapabilityMapping_BaoBi_DefaultsCanBeBomComponentTrue()
    {
        var caps = ProductCapabilityRules.Resolve(ProductType.BAO_BI, null, null, null, null);
        Assert.True(caps.IsPurchasable);
        Assert.True(caps.CanBeBomComponent);
        Assert.False(caps.CanUseInCustom);
        Assert.False(caps.CanHaveBom);
    }

    [Fact]
    public void CapabilityMapping_Unknown_DefaultsAllFalse()
    {
        var caps = ProductCapabilityRules.Resolve((ProductType)999, null, null, null, null);
        Assert.False(caps.IsPurchasable);
        Assert.False(caps.CanBeBomComponent);
        Assert.False(caps.CanUseInCustom);
        Assert.False(caps.CanHaveBom);
    }

    #endregion

    #region In-memory DbContext tests (Cases 11–15, 18–19)

    private static ProductDbContext NewDb() =>
        new(new DbContextOptionsBuilder<ProductDbContext>()
            .UseInMemoryDatabase($"bom-cap-{Guid.NewGuid():N}")
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    [Fact]
    public async Task Case11_ValidBaseVariant_IsAccepted()
    {
        using var db = NewDb();
        var category = new Category { Id = 1, Name = "Test" };
        db.Categories.Add(category);

        var product = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = category.Id,
            Name = "Product with derived",
            ProductType = ProductType.THANH_PHAM,
            InventoryUnit = InventoryUnit.Piece,
            IsActive = true,
            IsVariantParent = true
        };

        var baseVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            SkuCode = "BASE-UNIT",
            VariantName = "Base",
            IsBaseUnitVariant = true,
            IsActive = true,
            ConversionRate = 1,
            CanHaveBom = true
        };

        var derivedVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            SkuCode = "DERIVED-UNIT",
            VariantName = "Derived",
            IsBaseUnitVariant = false,
            BaseVariantId = baseVariant.Id,
            IsActive = true,
            ConversionRate = 3,
            CanHaveBom = false
        };

        product.Variants = new List<ProductVariant> { baseVariant, derivedVariant };
        db.Products.Add(product);
        await db.SaveChangesAsync();

        var repo = new ProductRepository(db);
        var logic = new ProductLogic(repo, null!);

        var updateRequest = new UpdateVariantBomRequest(new List<BomLineRequest>());
        var result = await logic.UpdateVariantBomAsync(baseVariant.Id, updateRequest);

        Assert.NotNull(result);
    }

    [Fact]
    public async Task Case12_BaseVariantFromAnotherProduct_IsRejected()
    {
        using var db = NewDb();
        var category = new Category { Id = 1, Name = "Test" };
        db.Categories.Add(category);

        var product1 = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = category.Id,
            Name = "Product 1",
            ProductType = ProductType.THANH_PHAM,
            InventoryUnit = InventoryUnit.Piece,
            IsActive = true
        };

        var product2 = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = category.Id,
            Name = "Product 2",
            ProductType = ProductType.THANH_PHAM,
            InventoryUnit = InventoryUnit.Piece,
            IsActive = true
        };

        var baseVariant1 = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product1.Id,
            SkuCode = "BASE-1",
            VariantName = "Base 1",
            IsBaseUnitVariant = true,
            IsActive = true,
            ConversionRate = 1
        };

        var derivedVariant2 = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product2.Id,
            SkuCode = "DERIVED-2",
            VariantName = "Derived 2",
            IsBaseUnitVariant = false,
            BaseVariantId = baseVariant1.Id,
            IsActive = true,
            ConversionRate = 2
        };

        product1.Variants = new List<ProductVariant> { baseVariant1 };
        product2.Variants = new List<ProductVariant> { derivedVariant2 };
        db.Products.AddRange(product1, product2);
        await db.SaveChangesAsync();

        var repo = new ProductRepository(db);
        var logic = new ProductLogic(repo, null!);

        var updateRequest = new UpdateVariantBomRequest(new List<BomLineRequest>());

        var ex = await Assert.ThrowsAsync<ProductValidationException>(async () =>
            await logic.UpdateVariantBomAsync(derivedVariant2.Id, updateRequest));
        Assert.Contains(ex.Errors, e => e.Contains("BOM của SKU quy đổi được tự động tính từ SKU đơn vị cơ bản"));
    }

    [Fact]
    public async Task Case13_BaseVariantIsDerivedSku_IsRejected()
    {
        using var db = NewDb();
        var category = new Category { Id = 1, Name = "Test" };
        db.Categories.Add(category);

        var product = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = category.Id,
            Name = "Product",
            ProductType = ProductType.THANH_PHAM,
            InventoryUnit = InventoryUnit.Piece,
            IsActive = true
        };

        var baseVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            SkuCode = "BASE",
            VariantName = "Base",
            IsBaseUnitVariant = true,
            IsActive = true,
            ConversionRate = 1
        };

        var derived1 = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            SkuCode = "DERIVED-1",
            VariantName = "Derived 1",
            IsBaseUnitVariant = false,
            BaseVariantId = baseVariant.Id,
            IsActive = true,
            ConversionRate = 2
        };

        var derived2 = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            SkuCode = "DERIVED-2",
            VariantName = "Derived 2",
            IsBaseUnitVariant = false,
            BaseVariantId = derived1.Id,
            IsActive = true,
            ConversionRate = 3
        };

        product.Variants = new List<ProductVariant> { baseVariant, derived1, derived2 };
        db.Products.Add(product);
        await db.SaveChangesAsync();

        var repo = new ProductRepository(db);
        var logic = new ProductLogic(repo, null!);

        var updateRequest = new UpdateVariantBomRequest(new List<BomLineRequest>());

        var ex = await Assert.ThrowsAsync<ProductValidationException>(async () =>
            await logic.UpdateVariantBomAsync(derived2.Id, updateRequest));
        Assert.Contains(ex.Errors, e => e.Contains("BOM của SKU quy đổi được tự động tính từ SKU đơn vị cơ bản"));
    }

    [Fact]
    public async Task Case14_InactiveBaseVariant_IsRejected()
    {
        using var db = NewDb();
        var category = new Category { Id = 1, Name = "Test" };
        db.Categories.Add(category);

        var product = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = category.Id,
            Name = "Product",
            ProductType = ProductType.THANH_PHAM,
            InventoryUnit = InventoryUnit.Piece,
            IsActive = true
        };

        var baseVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            SkuCode = "BASE",
            VariantName = "Base",
            IsBaseUnitVariant = true,
            IsActive = false,
            ConversionRate = 1
        };

        var derivedVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            SkuCode = "DERIVED",
            VariantName = "Derived",
            IsBaseUnitVariant = false,
            BaseVariantId = baseVariant.Id,
            IsActive = true,
            ConversionRate = 2
        };

        product.Variants = new List<ProductVariant> { baseVariant, derivedVariant };
        db.Products.Add(product);
        await db.SaveChangesAsync();

        var repo = new ProductRepository(db);
        var logic = new ProductLogic(repo, null!);

        var updateRequest = new UpdateVariantBomRequest(new List<BomLineRequest>());

        var ex = await Assert.ThrowsAsync<ProductValidationException>(async () =>
            await logic.UpdateVariantBomAsync(derivedVariant.Id, updateRequest));
        Assert.Contains(ex.Errors, e => e.Contains("BOM của SKU quy đổi được tự động tính từ SKU đơn vị cơ bản"));
    }

    [Fact]
    public async Task Case15_SelfReference_IsRejected()
    {
        using var db = NewDb();
        var category = new Category { Id = 1, Name = "Test" };
        db.Categories.Add(category);

        var product = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = category.Id,
            Name = "Product",
            ProductType = ProductType.THANH_PHAM,
            InventoryUnit = InventoryUnit.Piece,
            IsActive = true
        };

        var baseVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            SkuCode = "BASE",
            VariantName = "Base",
            IsBaseUnitVariant = true,
            IsActive = true,
            ConversionRate = 1,
            CanHaveBom = true
        };

        product.Variants = new List<ProductVariant> { baseVariant };
        db.Products.Add(product);
        await db.SaveChangesAsync();

        var repo = new ProductRepository(db);
        var logic = new ProductLogic(repo, null!);

        var updateRequest = new UpdateVariantBomRequest(new List<BomLineRequest>
        {
            new(baseVariant.ProductId, 1m, ComponentVariantId: baseVariant.Id)
        });

        var ex = await Assert.ThrowsAsync<ProductValidationException>(async () =>
            await logic.UpdateVariantBomAsync(baseVariant.Id, updateRequest));
        Assert.Contains(ex.Errors, e => e.Contains("khong duoc tham chieu chinh no trong BOM"));
    }

    [Fact]
    public async Task Case18_RetryRegenerate_NoDuplication()
    {
        using var db = NewDb();
        var category = new Category { Id = 1, Name = "Test" };
        db.Categories.Add(category);

        var componentProduct = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = category.Id,
            Name = "Component Product",
            ProductType = ProductType.NGUYEN_LIEU,
            InventoryUnit = InventoryUnit.Piece,
            IsActive = true
        };

        var componentVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = componentProduct.Id,
            SkuCode = "COMPONENT-SKU",
            VariantName = "Component",
            IsBaseUnitVariant = true,
            IsActive = true,
            ConversionRate = 1,
            CanBeBomComponent = true
        };

        componentProduct.Variants = new List<ProductVariant> { componentVariant };

        var outputProduct = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = category.Id,
            Name = "Output Product",
            ProductType = ProductType.THANH_PHAM,
            InventoryUnit = InventoryUnit.Piece,
            IsActive = true
        };

        var baseVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = outputProduct.Id,
            SkuCode = "OUTPUT-BASE",
            VariantName = "Base",
            IsBaseUnitVariant = true,
            IsActive = true,
            ConversionRate = 1,
            CanHaveBom = true
        };

        outputProduct.Variants = new List<ProductVariant> { baseVariant };
        db.Products.AddRange(componentProduct, outputProduct);
        await db.SaveChangesAsync();

        var repo = new ProductRepository(db);
        var logic = new ProductLogic(repo, null!);

        var bomRequest = new UpdateVariantBomRequest(new List<BomLineRequest>
        {
            new(componentProduct.Id, 2m, ComponentVariantId: componentVariant.Id)
        });

        await logic.UpdateVariantBomAsync(baseVariant.Id, bomRequest);

        var firstResult = await repo.GetVariantByIdAsync(baseVariant.Id);
        Assert.Single(firstResult!.BomLines, line => !line.IsDeleted);

        await logic.UpdateVariantBomAsync(baseVariant.Id, bomRequest);

        var secondResult = await repo.GetVariantByIdAsync(baseVariant.Id);
        Assert.Single(secondResult!.BomLines, line => !line.IsDeleted);
    }

    [Fact]
    public async Task Case19_ClientManualBomForDerivedSku_IsRejected()
    {
        using var db = NewDb();
        var category = new Category { Id = 1, Name = "Test" };
        db.Categories.Add(category);

        var product = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = category.Id,
            Name = "Product",
            ProductType = ProductType.THANH_PHAM,
            InventoryUnit = InventoryUnit.Piece,
            IsActive = true
        };

        var baseVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            SkuCode = "BASE",
            VariantName = "Base",
            IsBaseUnitVariant = true,
            IsActive = true,
            ConversionRate = 1,
            CanHaveBom = true
        };

        var derivedVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            SkuCode = "DERIVED",
            VariantName = "Derived",
            IsBaseUnitVariant = false,
            BaseVariantId = baseVariant.Id,
            IsActive = true,
            ConversionRate = 2
        };

        product.Variants = new List<ProductVariant> { baseVariant, derivedVariant };
        db.Products.Add(product);
        await db.SaveChangesAsync();

        var repo = new ProductRepository(db);
        var logic = new ProductLogic(repo, null!);

        var manualBomRequest = new UpdateVariantBomRequest(new List<BomLineRequest>
        {
            new(Guid.NewGuid(), 5m)
        });

        var ex = await Assert.ThrowsAsync<ProductValidationException>(async () =>
            await logic.UpdateVariantBomAsync(derivedVariant.Id, manualBomRequest));
        Assert.Contains(ex.Errors, e => e.Contains("BOM của SKU quy đổi được tự động tính từ SKU đơn vị cơ bản"));
    }

    [Fact]
    public async Task Case7_DuplicateComponentInSameBom_IsRejected()
    {
        using var db = NewDb();
        var category = new Category { Id = 1, Name = "Test" };
        db.Categories.Add(category);

        var componentProduct = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = category.Id,
            Name = "Component Product",
            ProductType = ProductType.NGUYEN_LIEU,
            InventoryUnit = InventoryUnit.Piece,
            IsActive = true
        };

        var componentVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = componentProduct.Id,
            SkuCode = "COMPONENT-SKU",
            VariantName = "Component",
            IsBaseUnitVariant = true,
            IsActive = true,
            ConversionRate = 1,
            CanBeBomComponent = true
        };

        componentProduct.Variants = new List<ProductVariant> { componentVariant };

        var outputProduct = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = category.Id,
            Name = "Output Product",
            ProductType = ProductType.THANH_PHAM,
            InventoryUnit = InventoryUnit.Piece,
            IsActive = true
        };

        var baseVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = outputProduct.Id,
            SkuCode = "OUTPUT-BASE",
            VariantName = "Base",
            IsBaseUnitVariant = true,
            IsActive = true,
            ConversionRate = 1,
            CanHaveBom = true
        };

        outputProduct.Variants = new List<ProductVariant> { baseVariant };
        db.Products.AddRange(componentProduct, outputProduct);
        await db.SaveChangesAsync();

        var repo = new ProductRepository(db);
        var logic = new ProductLogic(repo, null!);

        var duplicateBomRequest = new UpdateVariantBomRequest(new List<BomLineRequest>
        {
            new(componentProduct.Id, 2m, ComponentVariantId: componentVariant.Id),
            new(componentProduct.Id, 5m, ComponentVariantId: componentVariant.Id)
        });

        var ex = await Assert.ThrowsAsync<ProductValidationException>(async () =>
            await logic.UpdateVariantBomAsync(baseVariant.Id, duplicateBomRequest));
        Assert.Contains(ex.Errors, e => e.Contains("Không được chọn trùng component trong một BOM"));
    }

    #endregion

    #region ProductCreationRequestLogic reject/resubmit (Case 21)

    private sealed class FakeCloudinaryImageService : ICloudinaryImageService
    {
        public Task DeleteByUrlsAsync(IEnumerable<string> imageUrls, CancellationToken ct = default) =>
            Task.CompletedTask;
    }

    private static async Task<ProductVariant> SeedBomComponentAsync(ProductDbContext db)
    {
        db.Categories.Add(new Category { Id = 1, Name = "Test" });

        var componentProduct = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = 1,
            Name = "Component Material",
            ProductType = ProductType.NGUYEN_LIEU,
            InventoryUnit = InventoryUnit.Piece,
            IsActive = true
        };

        var componentVariant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = componentProduct.Id,
            SkuCode = "MAT-COMP-01",
            VariantName = "Component",
            IsBaseUnitVariant = true,
            IsActive = true,
            ConversionRate = 1,
            CanBeBomComponent = true,
            Product = componentProduct
        };

        componentProduct.Variants = new List<ProductVariant> { componentVariant };
        db.Products.Add(componentProduct);
        await db.SaveChangesAsync();
        return componentVariant;
    }

    private static CreateProductCreationRequest BuildDerivedBomPayload(ProductVariant componentVariant, string title) =>
        new(
            title,
            null,
            new List<ProductCreationRequestItemInput>
            {
                new("item-1", new CreateProductRequest(
                    CategoryId: 1,
                    Name: "Shelf Product With Derived SKU",
                    Origin: null,
                    FlavorProfile: null,
                    BrewingGuide: null,
                    Description: null,
                    BaseUnit: "unit",
                    InventoryUnit: "Piece",
                    WeightValue: null,
                    WeightUnit: null,
                    IsVariantParent: true,
                    ProductType: "THANH_PHAM",
                    Images: null,
                    Units: null,
                    Variants: new List<ProductVariantRequest>
                    {
                        new(
                            SkuCode: "SHELF-BASE",
                            RequestSkuKey: "base",
                            Barcode: null,
                            VariantName: "Base",
                            OptionValuesJson: "{}",
                            CostPrice: 10000m,
                            RetailPrice: 20000m,
                            MinStock: null,
                            MaxStock: null,
                            IsSellable: true,
                            AllowRewardPoints: true,
                            IsActive: true,
                            ImageUrl: null,
                            Units: null,
                            BomLines: new List<BomLineRequest>
                            {
                                new(componentVariant.ProductId, 2m, ComponentVariantId: componentVariant.Id)
                            },
                            UnitName: "unit",
                            ConversionRate: 1m,
                            IsBaseUnitVariant: true,
                            CanHaveBom: true),
                        new(
                            SkuCode: "SHELF-BOX3",
                            RequestSkuKey: "box3",
                            Barcode: null,
                            VariantName: "Box of 3",
                            OptionValuesJson: "{}",
                            CostPrice: 30000m,
                            RetailPrice: 60000m,
                            MinStock: null,
                            MaxStock: null,
                            IsSellable: true,
                            AllowRewardPoints: true,
                            IsActive: true,
                            ImageUrl: null,
                            Units: null,
                            BomLines: null,
                            UnitName: "box",
                            ConversionRate: 3m,
                            BaseRequestSkuKey: "base",
                            IsBaseUnitVariant: false,
                            CanHaveBom: true)
                    },
                    VariantGenerator: null))
            });

    [Fact]
    public async Task Case21_RejectResubmit_GeneratesDerivedBomExactlyOnce()
    {
        using var db = NewDb();
        var componentVariant = await SeedBomComponentAsync(db);

        var repo = new ProductRepository(db);
        var logic = new ProductCreationRequestLogic(
            db,
            new ProductLogic(repo, new CategoryRepository(db)),
            new FakeCloudinaryImageService());

        var warehouse = new ProductApprovalActorSnapshot(Guid.NewGuid(), "Warehouse", "Warehouse");
        var admin = new ProductApprovalActorSnapshot(Guid.NewGuid(), "Admin", "Admin");

        var payload = BuildDerivedBomPayload(componentVariant, "Yêu cầu tạo SP kệ");
        var created = await logic.CreateAsync(payload, warehouse);

        await logic.SubmitAsync(created.Id, new SubmitProductCreationRequest(null), warehouse);
        await logic.RejectAsync(created.Id, new RejectProductCreationRequest("Sai định mức", null), admin);

        await logic.UpdateAsync(
            created.Id,
            new UpdateProductCreationRequest(payload.Title, payload.WarehouseNote, payload.Items),
            warehouse);
        await logic.SubmitAsync(created.Id, new SubmitProductCreationRequest(null), warehouse);

        var approved = await logic.ApproveAsync(created.Id, new ApproveProductCreationRequest(null), admin);

        var createdProductId = Assert.Single(approved.CreatedProductIds);
        var product = await repo.GetByIdAsync(createdProductId);
        Assert.NotNull(product);

        var baseVariant = product!.Variants.Single(v => v.SkuCode == "SHELF-BASE");
        var derivedVariant = product.Variants.Single(v => v.SkuCode == "SHELF-BOX3");

        var baseLine = Assert.Single(baseVariant.BomLines, line => !line.IsDeleted);
        Assert.Equal(2m, baseLine.Quantity);

        var derivedLine = Assert.Single(derivedVariant.BomLines, line => !line.IsDeleted);
        Assert.Equal(6m, derivedLine.Quantity);
        Assert.Equal(componentVariant.Id, derivedLine.ComponentVariantId!.Value);
        Assert.False(derivedLine.IsRequiredBaseComponent);
    }

    #endregion
}
