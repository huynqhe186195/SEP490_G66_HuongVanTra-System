using CustomerService.Application.Interfaces;
using CustomerService.Application.UseCases;
using CustomerService.Domain.Entities;
using CustomerService.Domain.Enums;
using Moq;
using Xunit;

namespace CustomerService.Application.Tests;

public sealed class CustomerTierUpgradeTests
{
    [Fact]
    public async Task Completed_order_at_threshold_upgrades_to_highest_eligible_tier()
    {
        var member = new CustomerTier { Id = 1, TierName = "Member", MinSpendingThreshold = 0 };
        var gold = new CustomerTier { Id = 2, TierName = "Gold", MinSpendingThreshold = 1_000_000 };
        var customer = CreateCustomer(member, totalSpending: 900_000);
        var (logic, customerRepo, tierRepo, processedEvents) = CreateLogic(customer, gold);

        var result = await logic.HandleOrderCompletedAsync(
            Guid.NewGuid(), "ORD-THRESHOLD", customer.Id, 100_000, debtAmount: 0);

        Assert.True(result.TierUpgraded);
        Assert.Equal(gold.Id, customer.TierId);
        Assert.Equal("Gold", result.TierName);
        Assert.Equal(1_000_000, result.TotalSpending);
        tierRepo.Verify(r => r.GetTierForSpendingAsync(1_000_000, It.IsAny<CancellationToken>()), Times.Once);
        processedEvents.Verify(r => r.AddAsync("OrderCompleted", It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Once);
        customerRepo.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Completed_order_below_next_threshold_does_not_upgrade()
    {
        var member = new CustomerTier { Id = 1, TierName = "Member", MinSpendingThreshold = 0 };
        var customer = CreateCustomer(member, totalSpending: 899_999);
        var (logic, _, tierRepo, _) = CreateLogic(customer, member);

        var result = await logic.HandleOrderCompletedAsync(
            Guid.NewGuid(), "ORD-BELOW-THRESHOLD", customer.Id, 1, debtAmount: 0);

        Assert.False(result.TierUpgraded);
        Assert.Equal(member.Id, customer.TierId);
        tierRepo.Verify(r => r.GetTierForSpendingAsync(900_000, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Duplicate_completed_event_does_not_change_spending_or_tier()
    {
        var member = new CustomerTier { Id = 1, TierName = "Member", MinSpendingThreshold = 0 };
        var customer = CreateCustomer(member, totalSpending: 900_000);
        var (logic, customerRepo, tierRepo, processedEvents) = CreateLogic(customer, member, isDuplicate: true);

        var result = await logic.HandleOrderCompletedAsync(
            Guid.NewGuid(), "ORD-DUPLICATE", customer.Id, 100_000, debtAmount: 0);

        Assert.True(result.SkippedDuplicate);
        Assert.Equal(900_000, customer.TotalSpending);
        Assert.Equal(member.Id, customer.TierId);
        customerRepo.Verify(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        tierRepo.Verify(r => r.GetTierForSpendingAsync(It.IsAny<decimal>(), It.IsAny<CancellationToken>()), Times.Never);
        processedEvents.Verify(r => r.AddAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static Customer CreateCustomer(CustomerTier tier, decimal totalSpending) => new()
    {
        Id = Guid.NewGuid(),
        FullName = "Customer tier test",
        PhoneNumber = "0900000000",
        CustomerGroup = CustomerGroup.PhoThong,
        TierId = tier.Id,
        Tier = tier,
        TotalSpending = totalSpending
    };

    private static (CustomerLogic Logic, Mock<ICustomerRepository> CustomerRepo,
        Mock<ICustomerTierRepository> TierRepo, Mock<IProcessedIntegrationEventRepository> ProcessedEvents)
        CreateLogic(Customer customer, CustomerTier eligibleTier, bool isDuplicate = false)
    {
        var customerRepo = new Mock<ICustomerRepository>();
        customerRepo.Setup(r => r.GetByIdAsync(customer.Id, It.IsAny<CancellationToken>())).ReturnsAsync(customer);
        customerRepo.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var tierRepo = new Mock<ICustomerTierRepository>();
        tierRepo.Setup(r => r.GetTierForSpendingAsync(It.IsAny<decimal>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(eligibleTier);

        var processedEvents = new Mock<IProcessedIntegrationEventRepository>();
        processedEvents.Setup(r => r.ExistsAsync("OrderCompleted", It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(isDuplicate);
        processedEvents.Setup(r => r.AddAsync("OrderCompleted", It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var debtRepo = new Mock<ICustomerDebtTransactionRepository>();
        var allocationRepo = new Mock<ICustomerDebtAllocationRepository>();
        var activityRepo = new Mock<ICustomerActivityRepository>();
        activityRepo.Setup(r => r.AddAsync(It.IsAny<CustomerActivity>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var addressRepo = new Mock<ICustomerAddressRepository>();

        return (new CustomerLogic(customerRepo.Object, tierRepo.Object, processedEvents.Object,
                debtRepo.Object, allocationRepo.Object, activityRepo.Object, addressRepo.Object),
            customerRepo, tierRepo, processedEvents);
    }
}
