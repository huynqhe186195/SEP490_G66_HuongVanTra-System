using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.DTOs.Responses;
using CustomerService.Application.Interfaces;
using CustomerService.Application.UseCases;
using CustomerService.Domain.Entities;
using CustomerService.Domain.Enums;
using CustomerService.Domain.Exceptions;
using CustomerService.Infrastructure.Data;
using CustomerService.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace CustomerService.Application.Tests;

public sealed class CheckoutCustomerSearchTests
{
    private readonly Guid _saleOneId = Guid.NewGuid();
    private readonly Guid _saleTwoId = Guid.NewGuid();

    [Fact]
    public async Task Sale_search_returns_only_assigned_customers()
    {
        await using var db = CreateDb();
        var own = Customer("KH000001", "Nguyễn An", "0901111111", CustomerGroup.PhoThong, _saleOneId);
        var other = Customer("KH000002", "Nguyễn Bình", "0902222222", CustomerGroup.PhoThong, _saleTwoId);
        var unassigned = Customer("KH000003", "Nguyễn Chi", "0903333333", CustomerGroup.PhoThong, null);
        await SeedAsync(db, own, other, unassigned);

        var result = await CreateLogic(db).SearchForCheckoutAsync(
            new CheckoutCustomerSearchRequest(Search: "Nguyễn"),
            SaleAccess());

        Assert.Equal([own.Id], result.Items.Select(x => x.Id));
        Assert.Equal(1, result.TotalCount);
    }

    [Fact]
    public async Task Exact_phone_returns_only_the_permitted_customer()
    {
        await using var db = CreateDb();
        var own = Customer("KH000001", "Khách của Sale 1", "0901234567", CustomerGroup.PhoThong, _saleOneId);
        var other = Customer("KH000002", "Khách của Sale 2", "0911234567", CustomerGroup.PhoThong, _saleTwoId);
        await SeedAsync(db, own, other);
        var logic = CreateLogic(db);

        var ownResult = await logic.SearchForCheckoutAsync(
            new CheckoutCustomerSearchRequest(Search: "090 123 4567", ExactPhone: true),
            SaleAccess());
        var otherResult = await logic.SearchForCheckoutAsync(
            new CheckoutCustomerSearchRequest(Search: other.PhoneNumber, ExactPhone: true),
            SaleAccess());

        Assert.Equal([own.Id], ownResult.Items.Select(x => x.Id));
        Assert.Empty(otherResult.Items);
    }

    [Fact]
    public async Task Existing_exact_phone_lookup_cannot_bypass_assignment_scope()
    {
        await using var db = CreateDb();
        var other = Customer("KH000002", "Khách của Sale 2", "0911234567", CustomerGroup.PhoThong, _saleTwoId);
        await SeedAsync(db, other);

        await Assert.ThrowsAsync<CustomerForbiddenException>(() =>
            CreateLogic(db).GetByPhoneAsync(other.PhoneNumber, SaleAccess()));
    }

    [Theory]
    [InlineData("Khách Sale Khác")]
    [InlineData("KH999999")]
    public async Task Sale_cannot_find_another_sales_customer_by_name_or_code(string search)
    {
        await using var db = CreateDb();
        await SeedAsync(
            db,
            Customer("KH999999", "Khách Sale Khác", "0911234567", CustomerGroup.PhoThong, _saleTwoId));

        var result = await CreateLogic(db).SearchForCheckoutAsync(
            new CheckoutCustomerSearchRequest(Search: search),
            SaleAccess());

        Assert.Empty(result.Items);
    }

    [Theory]
    [InlineData("Nguyễn An")]
    [InlineData("KH000001")]
    [InlineData("090111")]
    public async Task Search_supports_name_code_and_phone(string search)
    {
        await using var db = CreateDb();
        var customer = Customer("KH000001", "Nguyễn An", "0901111111", CustomerGroup.PhoThong, _saleOneId);
        await SeedAsync(db, customer);

        var result = await CreateLogic(db).SearchForCheckoutAsync(
            new CheckoutCustomerSearchRequest(Search: search),
            SaleAccess());

        Assert.Equal([customer.Id], result.Items.Select(x => x.Id));
    }

    [Theory]
    [InlineData("GENERAL", CustomerGroup.PhoThong)]
    [InlineData("VIP", CustomerGroup.DoiNgoai)]
    [InlineData("CORPORATE", CustomerGroup.DoanhNghiep)]
    public async Task Customer_type_filter_uses_the_current_customer_classification(
        string customerType,
        CustomerGroup expectedGroup)
    {
        await using var db = CreateDb();
        var expected = Customer("KH000001", "Expected", "0901111111", expectedGroup, _saleOneId);
        var differentGroup = expectedGroup == CustomerGroup.PhoThong
            ? CustomerGroup.DoiNgoai
            : CustomerGroup.PhoThong;
        await SeedAsync(
            db,
            expected,
            Customer("KH000002", "Different", "0902222222", differentGroup, _saleOneId));

        var result = await CreateLogic(db).SearchForCheckoutAsync(
            new CheckoutCustomerSearchRequest(CustomerType: customerType),
            SaleAccess());

        Assert.Equal([expected.Id], result.Items.Select(x => x.Id));
    }

    [Fact]
    public async Task Admin_or_manager_permission_can_search_all_customers()
    {
        await using var db = CreateDb();
        var own = Customer("KH000001", "One", "0901111111", CustomerGroup.PhoThong, _saleOneId);
        var other = Customer("KH000002", "Two", "0902222222", CustomerGroup.PhoThong, _saleTwoId);
        var unassigned = Customer("KH000003", "Three", "0903333333", CustomerGroup.PhoThong, null);
        await SeedAsync(db, own, other, unassigned);
        var logic = CreateLogic(db);

        var adminResult = await logic.SearchForCheckoutAsync(
            new CheckoutCustomerSearchRequest(CustomerType: "GENERAL"),
            new CustomerAccessContext(Guid.NewGuid(), CanViewAllCustomers: true));
        var managerResult = await logic.SearchForCheckoutAsync(
            new CheckoutCustomerSearchRequest(CustomerType: "GENERAL"),
            new CustomerAccessContext(Guid.NewGuid(), CanViewAllCustomers: true));

        Assert.Equal(3, adminResult.TotalCount);
        Assert.Equal(3, managerResult.TotalCount);
    }

    [Fact]
    public async Task Empty_search_returns_an_empty_idle_result()
    {
        await using var db = CreateDb();
        await SeedAsync(db, Customer("KH000001", "One", "0901111111", CustomerGroup.PhoThong, _saleOneId));

        var result = await CreateLogic(db).SearchForCheckoutAsync(
            new CheckoutCustomerSearchRequest(Search: "   "),
            SaleAccess());

        Assert.Empty(result.Items);
        Assert.Equal(0, result.TotalCount);
    }

    [Fact]
    public async Task Search_input_is_trimmed_and_safely_limited()
    {
        await using var db = CreateDb();
        var customer = Customer("KH000001", "Nguyễn An", "0901111111", CustomerGroup.PhoThong, _saleOneId);
        await SeedAsync(db, customer);
        var logic = CreateLogic(db);

        var normalized = await logic.SearchForCheckoutAsync(
            new CheckoutCustomerSearchRequest(Search: "   Nguyễn   An   "),
            SaleAccess());

        Assert.Equal([customer.Id], normalized.Items.Select(x => x.Id));
        await Assert.ThrowsAsync<CustomerValidationException>(() =>
            logic.SearchForCheckoutAsync(
                new CheckoutCustomerSearchRequest(Search: new string('x', 101)),
                SaleAccess()));
        await Assert.ThrowsAsync<CustomerValidationException>(() =>
            logic.SearchForCheckoutAsync(
                new CheckoutCustomerSearchRequest(Search: "090123", ExactPhone: true),
                SaleAccess()));
    }

    [Fact]
    public async Task Pagination_is_deterministic_and_bounded()
    {
        await using var db = CreateDb();
        await SeedAsync(
            db,
            Customer("KH000003", "C", "0903333333", CustomerGroup.PhoThong, _saleOneId),
            Customer("KH000001", "A", "0901111111", CustomerGroup.PhoThong, _saleOneId),
            Customer("KH000002", "B", "0902222222", CustomerGroup.PhoThong, _saleOneId));
        var logic = CreateLogic(db);

        var firstPage = await logic.SearchForCheckoutAsync(
            new CheckoutCustomerSearchRequest(CustomerType: "GENERAL", Page: 1, PageSize: 2),
            SaleAccess());
        var secondPage = await logic.SearchForCheckoutAsync(
            new CheckoutCustomerSearchRequest(CustomerType: "GENERAL", Page: 2, PageSize: 2),
            SaleAccess());

        Assert.Equal(["KH000001", "KH000002"], firstPage.Items.Select(x => x.CustomerCode));
        Assert.Equal(["KH000003"], secondPage.Items.Select(x => x.CustomerCode));
        Assert.Equal(3, firstPage.TotalCount);
    }

    [Fact]
    public async Task Checkout_response_contains_only_the_minimal_fields()
    {
        await using var db = CreateDb();
        var tier = new CustomerTier
        {
            Id = 1,
            TierName = "Thành viên",
            DiscountPercent = 5,
            MinSpendingThreshold = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.CustomerTiers.Add(tier);
        var customer = Customer("KH000001", "One", "0901111111", CustomerGroup.PhoThong, _saleOneId);
        customer.TierId = tier.Id;
        customer.CurrentDebt = 125_000;
        await SeedAsync(db, customer);

        var result = await CreateLogic(db).SearchForCheckoutAsync(
            new CheckoutCustomerSearchRequest(Search: customer.PhoneNumber, ExactPhone: true),
            SaleAccess());
        var item = Assert.Single(result.Items);
        var exposedNames = typeof(CheckoutCustomerSearchResponse)
            .GetProperties()
            .Select(x => x.Name)
            .Order()
            .ToArray();

        Assert.Equal(5, item.TierDiscountPercent);
        Assert.Equal(125_000, item.CurrentDebt);
        Assert.Equal(
            new[]
            {
                "CurrentDebt", "CustomerCode", "CustomerGroup", "FullName", "Id",
                "PhoneNumber", "TierDiscountPercent", "TierId", "TierName"
            }.Order(),
            exposedNames);
    }

    private CustomerAccessContext SaleAccess() =>
        new(_saleOneId, CanViewAllCustomers: false);

    private static CustomerDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<CustomerDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new CustomerDbContext(options);
    }

    private static async Task SeedAsync(CustomerDbContext db, params Customer[] customers)
    {
        db.Customers.AddRange(customers);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
    }

    private static Customer Customer(
        string code,
        string name,
        string phone,
        CustomerGroup group,
        Guid? assignedSaleId) =>
        new()
        {
            Id = Guid.NewGuid(),
            CustomerCode = code,
            FullName = name,
            PhoneNumber = phone,
            CustomerGroup = group,
            AssignedSaleId = assignedSaleId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

    private static CustomerLogic CreateLogic(CustomerDbContext db) =>
        new(
            new CustomerRepository(db),
            Mock.Of<ICustomerTierRepository>(),
            Mock.Of<IProcessedIntegrationEventRepository>(),
            Mock.Of<ICustomerDebtTransactionRepository>(),
            Mock.Of<ICustomerDebtAllocationRepository>(),
            Mock.Of<ICustomerActivityRepository>(),
            Mock.Of<ICustomerAddressRepository>());
}
