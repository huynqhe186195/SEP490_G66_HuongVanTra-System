using Moq;
using OrderService.Application.Interfaces;
using OrderService.Application.UseCases;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;
using Xunit;

namespace OrderService.Application.Tests;

public sealed class PromotionBaselineTests
{
    [Fact]
    public async Task Percentage_promotion_calculates_on_order_scope()
    {
        var promotion = CreatePromotion(PromotionDiscountType.PERCENTAGE, 10, PromotionScopeType.ORDER);
        var logic = CreateLogic(promotion);

        var result = await logic.ValidateAndCalculateDiscountAsync(
            promotion.Id, null,
            [new PromotionCalculationItem(Guid.NewGuid(), 2, 50_000, 100_000)],
            manualDiscount: 0, customerId: null);

        Assert.Equal(10_000, result.DiscountAmount);
        Assert.Equal(100_000, result.EligibleSubtotal);
    }

    [Fact]
    public async Task Sku_scope_applies_only_to_configured_sku()
    {
        var eligibleSku = Guid.NewGuid();
        var promotion = CreatePromotion(PromotionDiscountType.FIXED, 25_000, PromotionScopeType.SKU);
        promotion.Scopes.Add(new PromotionScope
        {
            Id = Guid.NewGuid(), PromotionId = promotion.Id, ScopeType = PromotionScopeType.SKU, SkuId = eligibleSku
        });
        var logic = CreateLogic(promotion);

        var result = await logic.ValidateAndCalculateDiscountAsync(
            promotion.Id, null,
            [
                new PromotionCalculationItem(eligibleSku, 1, 50_000, 50_000),
                new PromotionCalculationItem(Guid.NewGuid(), 1, 50_000, 50_000)
            ],
            manualDiscount: 0, customerId: null);

        Assert.Equal(25_000, result.DiscountAmount);
        Assert.Equal(50_000, result.EligibleSubtotal);
    }

    [Fact]
    public async Task Promotion_cannot_stack_with_manual_discount()
    {
        var promotion = CreatePromotion(PromotionDiscountType.FIXED, 10_000, PromotionScopeType.ORDER);
        var logic = CreateLogic(promotion);

        await Assert.ThrowsAsync<OrderValidationException>(() => logic.ValidateAndCalculateDiscountAsync(
            promotion.Id, null,
            [new PromotionCalculationItem(Guid.NewGuid(), 1, 100_000, 100_000)],
            manualDiscount: 1_000, customerId: null));
    }

    private static Promotion CreatePromotion(PromotionDiscountType type, decimal value, PromotionScopeType scope) => new()
    {
        Id = Guid.NewGuid(), PromoCode = "PROMO", NormalizedPromoCode = "PROMO",
        DiscountType = type, DiscountValue = value, ScopeType = scope,
        MaxDiscountAmount = type == PromotionDiscountType.PERCENTAGE ? 100_000 : null,
        IsActive = true, ValidFromUtc = DateTime.UtcNow.AddMinutes(-1), ValidToUtc = DateTime.UtcNow.AddDays(1)
    };

    private static PromotionLogic CreateLogic(Promotion promotion)
    {
        var repo = new Mock<IPromotionRepository>();
        repo.Setup(r => r.GetByIdAsync(promotion.Id, It.IsAny<CancellationToken>())).ReturnsAsync(promotion);
        repo.Setup(r => r.CountOrdersUsingPromotionAsync(promotion.Id, It.IsAny<CancellationToken>())).ReturnsAsync(0);
        var customers = new Mock<ICustomerCatalogClient>();
        return new PromotionLogic(repo.Object, customers.Object);
    }
}
