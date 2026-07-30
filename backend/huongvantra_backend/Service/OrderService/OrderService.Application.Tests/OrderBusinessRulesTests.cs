using OrderService.Domain.Exceptions;
using OrderService.Domain.Rules;
using Xunit;

namespace OrderService.Application.Tests;

public class OrderBusinessRulesTests
{
    [Fact]
    public void PieceQuantity_AcceptsPositiveInteger()
    {
        var quantity = OrderBusinessRules.NormalizeBaseQuantity(3m, "Piece");

        Assert.Equal(3, quantity);
    }

    [Fact]
    public void PieceQuantity_RejectsDecimalWithoutRounding()
    {
        var exception = Assert.Throws<OrderValidationException>(
            () => OrderBusinessRules.NormalizeBaseQuantity(1.6m, "Piece"));

        Assert.Contains("không tự làm tròn", exception.Message);
    }

    [Fact]
    public void GramQuantity_RemainsExactIntegerGramsForPersistence()
    {
        var quantity = OrderBusinessRules.NormalizeBaseQuantity(475m, "Gram");

        Assert.Equal(475, quantity);
    }

    [Fact]
    public void NormalCustomer_ManualDiscountIsRejected()
    {
        Assert.Throws<OrderValidationException>(
            () => OrderBusinessRules.EnsureManualDiscountAllowed(
                10_000m,
                "CaNhan"));
    }

    [Fact]
    public void Guest_ManualDiscountIsRejected()
    {
        Assert.Throws<OrderValidationException>(
            () => OrderBusinessRules.EnsureManualDiscountAllowed(
                10_000m,
                null));
    }

    [Fact]
    public void TierNonVipCustomer_ManualDiscountIsRejected()
    {
        Assert.Throws<OrderValidationException>(
            () => OrderBusinessRules.EnsureManualDiscountAllowed(
                10_000m,
                "CaNhan",
                tierId: 2));
    }

    [Fact]
    public void VipCustomer_ManualDiscountIsAllowed()
    {
        OrderBusinessRules.EnsureManualDiscountAllowed(
            10_000m,
            "DoiNgoai",
            tierId: 2);
    }

    [Fact]
    public void DirectApiDiscountManipulation_CannotUseTierAsVip()
    {
        var exception = Assert.Throws<OrderValidationException>(
            () => OrderBusinessRules.EnsureManualDiscountAllowed(
                999_999m,
                "CaNhan",
                tierId: 1));

        Assert.Contains("VIP", exception.Message);
    }

    [Fact]
    public void GuestFullyPaidOrder_IsAllowed()
    {
        OrderBusinessRules.EnsureGuestFullyPaid(null, 100_000m, 100_000m);
    }

    [Fact]
    public void GuestUnpaidOrder_IsRejected()
    {
        Assert.Throws<OrderValidationException>(
            () => OrderBusinessRules.EnsureGuestFullyPaid(null, 0m, 100_000m));
    }

    [Fact]
    public void GuestPartiallyPaidOrder_IsRejected()
    {
        Assert.Throws<OrderValidationException>(
            () => OrderBusinessRules.EnsureGuestFullyPaid(null, 40_000m, 100_000m));
    }

    [Fact]
    public void RegisteredCustomerDebtPolicy_RemainsUnchanged()
    {
        OrderBusinessRules.EnsureGuestFullyPaid(
            Guid.NewGuid(),
            0m,
            100_000m);
    }

    [Fact]
    public void Corporate_ManualDiscountWithinContractPercent_IsAllowed()
    {
        OrderBusinessRules.EnsureManualDiscountAllowed(
            100_000m,
            "DoanhNghiep",
            contractDiscountPercent: 10m,
            subtotal: 1_000_000m);
    }

    [Fact]
    public void Corporate_ManualDiscountAboveContractPercent_IsRejected()
    {
        var exception = Assert.Throws<OrderValidationException>(
            () => OrderBusinessRules.EnsureManualDiscountAllowed(
                150_000m,
                "DoanhNghiep",
                contractDiscountPercent: 10m,
                subtotal: 1_000_000m));

        Assert.Contains("vượt mức hợp đồng", exception.Message);
    }

    [Fact]
    public void Corporate_ManualDiscountWithoutContractPercent_IsRejected()
    {
        var exception = Assert.Throws<OrderValidationException>(
            () => OrderBusinessRules.EnsureManualDiscountAllowed(
                50_000m,
                "DoanhNghiep",
                subtotal: 1_000_000m));

        Assert.Contains("hợp đồng đang hiệu lực", exception.Message);
    }

    [Fact]
    public void Corporate_WithoutContract_OrderIsRejected()
    {
        Assert.Throws<OrderValidationException>(
            () => OrderBusinessRules.EnsureContractRequiredForCorporate("DoanhNghiep", null));
    }

    [Fact]
    public void Corporate_WithContract_OrderIsAllowed()
    {
        OrderBusinessRules.EnsureContractRequiredForCorporate("DoanhNghiep", Guid.NewGuid());
    }

    [Fact]
    public void NonCorporate_WithoutContract_OrderIsAllowed()
    {
        OrderBusinessRules.EnsureContractRequiredForCorporate("CaNhan", null);
        OrderBusinessRules.EnsureContractRequiredForCorporate(null, null);
    }

    [Fact]
    public void CreditLimit_ProjectedDebtAboveLimit_IsRejected()
    {
        var exception = Assert.Throws<OrderValidationException>(
            () => OrderBusinessRules.EnsureCreditLimitNotExceeded(
                currentDebt: 4_500_000m,
                unpaidAmount: 800_000m,
                creditLimit: 5_000_000m));

        Assert.Contains("vượt hạn mức", exception.Message);
    }

    [Fact]
    public void CreditLimit_ProjectedDebtWithinLimit_IsAllowed()
    {
        OrderBusinessRules.EnsureCreditLimitNotExceeded(
            currentDebt: 4_500_000m,
            unpaidAmount: 300_000m,
            creditLimit: 5_000_000m);
    }

    [Fact]
    public void CreditLimit_NotConfigured_SkipsCheck()
    {
        OrderBusinessRules.EnsureCreditLimitNotExceeded(
            currentDebt: 99_000_000m,
            unpaidAmount: 99_000_000m,
            creditLimit: null);
    }

    [Fact]
    public void CreditLimit_FullyPaidOrder_SkipsCheck()
    {
        OrderBusinessRules.EnsureCreditLimitNotExceeded(
            currentDebt: 5_000_000m,
            unpaidAmount: 0m,
            creditLimit: 5_000_000m);
    }
}
