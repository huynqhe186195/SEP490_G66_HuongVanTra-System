using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.Interfaces;
using CustomerService.Application.UseCases;
using CustomerService.Domain.Entities;
using CustomerService.Domain.Enums;
using CustomerService.Domain.Exceptions;
using Moq;
using Xunit;

namespace CustomerService.Application.Tests;

public sealed class CustomerDebtPaymentTests
{
    [Fact]
    public async Task Payment_without_explicit_allocation_uses_oldest_debts_first()
    {
        var customer = CreateCustomer(150);
        var oldestOrder = CreateOrderDebt(customer.Id, "ORD-OLD", 100, DateTime.UtcNow.AddDays(-2));
        var newestOrder = CreateOrderDebt(customer.Id, "ORD-NEW", 50, DateTime.UtcNow.AddDays(-1));
        var logic = CreateLogic(customer, [oldestOrder, newestOrder]);

        var result = await logic.ApplyDebtPaymentAsync(
            customer.Id,
            new ApplyDebtPaymentRequest(120, "FIFO test"),
            new CustomerAccessContext(customer.Id, CanViewAllCustomers: true));

        Assert.Equal(120, result.AllocatedAmount);
        Assert.Collection(result.Allocations,
            allocation =>
            {
                Assert.Equal(oldestOrder.ReferenceId, allocation.OrderId);
                Assert.Equal(100, allocation.Amount);
                Assert.Equal(0, allocation.RemainingAfter);
            },
            allocation =>
            {
                Assert.Equal(newestOrder.ReferenceId, allocation.OrderId);
                Assert.Equal(20, allocation.Amount);
                Assert.Equal(30, allocation.RemainingAfter);
            });
        Assert.Equal(30, customer.CurrentDebt);
    }

    [Fact]
    public async Task Payment_rejects_total_allocation_above_one_orders_remaining_debt()
    {
        var customer = CreateCustomer(150);
        var oldestOrder = CreateOrderDebt(customer.Id, "ORD-OLD", 100, DateTime.UtcNow.AddDays(-2));
        var newestOrder = CreateOrderDebt(customer.Id, "ORD-NEW", 50, DateTime.UtcNow.AddDays(-1));
        var logic = CreateLogic(customer, [oldestOrder, newestOrder]);

        await Assert.ThrowsAsync<CustomerValidationException>(() => logic.ApplyDebtPaymentAsync(
            customer.Id,
            new ApplyDebtPaymentRequest(120, "Duplicate allocation", Allocations:
            [
                new DebtAllocationItemRequest(oldestOrder.ReferenceId!.Value, 60),
                new DebtAllocationItemRequest(oldestOrder.ReferenceId!.Value, 60)
            ]),
            new CustomerAccessContext(customer.Id, CanViewAllCustomers: true)));

        Assert.Equal(150, customer.CurrentDebt);
    }

    [Fact]
    public async Task Payment_rejects_amount_above_total_outstanding_debt()
    {
        var customer = CreateCustomer(100);
        var order = CreateOrderDebt(customer.Id, "ORD-ONLY", 100, DateTime.UtcNow.AddDays(-1));
        var logic = CreateLogic(customer, [order]);

        await Assert.ThrowsAsync<CustomerValidationException>(() => logic.ApplyDebtPaymentAsync(
            customer.Id,
            new ApplyDebtPaymentRequest(101, "Overpayment"),
            new CustomerAccessContext(customer.Id, CanViewAllCustomers: true)));

        Assert.Equal(100, customer.CurrentDebt);
    }

    private static Customer CreateCustomer(decimal debt) => new()
    {
        Id = Guid.NewGuid(),
        FullName = "Debt test customer",
        PhoneNumber = "0900000000",
        CustomerGroup = CustomerGroup.PhoThong,
        CurrentDebt = debt
    };

    private static CustomerDebtTransaction CreateOrderDebt(
        Guid customerId, string orderCode, decimal amount, DateTime createdAt) => new()
    {
        Id = Guid.NewGuid(),
        CustomerId = customerId,
        Type = DebtTransactionType.IncreaseDebt,
        Amount = amount,
        BalanceAfter = amount,
        ReferenceType = "Order",
        ReferenceId = Guid.NewGuid(),
        RelatedOrderCode = orderCode,
        CreatedAt = createdAt
    };

    private static CustomerLogic CreateLogic(Customer customer, IReadOnlyList<CustomerDebtTransaction> debts)
    {
        var customerRepo = new Mock<ICustomerRepository>();
        customerRepo.Setup(r => r.GetByIdAsync(customer.Id, It.IsAny<CancellationToken>())).ReturnsAsync(customer);
        customerRepo.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var tierRepo = new Mock<ICustomerTierRepository>();
        var processedEvents = new Mock<IProcessedIntegrationEventRepository>();
        var debtRepo = new Mock<ICustomerDebtTransactionRepository>();
        debtRepo.Setup(r => r.GetLedgerBalanceAsync(customer.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(customer.CurrentDebt);
        debtRepo.Setup(r => r.GetByCustomerIdAsync(customer.Id, It.IsAny<CancellationToken>())).ReturnsAsync(debts);
        debtRepo.Setup(r => r.AddAsync(It.IsAny<CustomerDebtTransaction>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var allocationRepo = new Mock<ICustomerDebtAllocationRepository>();
        allocationRepo.Setup(r => r.GetByCustomerIdAsync(customer.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        allocationRepo.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<CustomerDebtAllocation>>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var activityRepo = new Mock<ICustomerActivityRepository>();
        activityRepo.Setup(r => r.AddAsync(It.IsAny<CustomerActivity>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var addressRepo = new Mock<ICustomerAddressRepository>();

        return new CustomerLogic(customerRepo.Object, tierRepo.Object, processedEvents.Object,
            debtRepo.Object, allocationRepo.Object, activityRepo.Object, addressRepo.Object);
    }
}
