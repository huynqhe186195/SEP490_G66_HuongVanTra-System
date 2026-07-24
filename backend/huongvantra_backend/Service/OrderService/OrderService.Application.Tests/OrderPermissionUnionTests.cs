using Microsoft.EntityFrameworkCore;
using OrderService.Application.Authorization;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;
using OrderService.Infrastructure.Repositories;
using Xunit;

namespace OrderService.Application.Tests;

public class OrderPermissionUnionTests
{
    [Fact]
    public void SalePos_scope_views_every_order_regardless_of_creator()
    {
        var userId = Guid.NewGuid();
        var access = new OrderAccessContext(
            userId,
            CanViewAllOrders: false,
            CanViewAllCodOrders: false,
            CanViewOwnOrders: true);

        Assert.True(access.CanViewOrder(Order(userId, OrderChannel.POS)));
        Assert.True(access.CanViewOrder(Order(Guid.NewGuid(), OrderChannel.POS)));
        Assert.True(access.CanViewOrder(Order(Guid.NewGuid(), OrderChannel.COD)));
        Assert.Null(access.EmployeeFilter);
        Assert.False(access.CodOrdersOnly);
    }

    [Fact]
    public void SalePos_scope_modifies_only_its_own_non_COD_order()
    {
        var userId = Guid.NewGuid();
        var access = new OrderAccessContext(
            userId,
            CanViewAllOrders: false,
            CanViewAllCodOrders: false,
            CanViewOwnOrders: true);

        Assert.True(access.CanModifyOrder(Order(userId, OrderChannel.POS)));
        Assert.False(access.CanModifyOrder(Order(Guid.NewGuid(), OrderChannel.POS)));
        Assert.False(access.CanModifyOrder(Order(userId, OrderChannel.COD)));
    }

    [Fact]
    public void SaleCod_scope_stays_limited_to_COD_channel()
    {
        var userId = Guid.NewGuid();
        var access = new OrderAccessContext(
            userId,
            CanViewAllOrders: false,
            CanViewAllCodOrders: true,
            CanViewOwnOrders: false);

        Assert.True(access.CanViewOrder(Order(Guid.NewGuid(), OrderChannel.COD)));
        Assert.False(access.CanViewOrder(Order(userId, OrderChannel.POS)));
        Assert.True(access.CanModifyOrder(Order(Guid.NewGuid(), OrderChannel.COD)));
        Assert.False(access.CanModifyOrder(Order(userId, OrderChannel.POS)));
        Assert.True(access.CodOrdersOnly);
    }

    [Fact]
    public void Dual_sale_scope_views_all_and_modifies_own_counter_plus_all_COD()
    {
        var userId = Guid.NewGuid();
        var access = new OrderAccessContext(
            userId,
            CanViewAllOrders: false,
            CanViewAllCodOrders: true,
            CanViewOwnOrders: true);

        Assert.True(access.CanViewOrder(Order(Guid.NewGuid(), OrderChannel.POS)));
        Assert.True(access.CanViewOrder(Order(Guid.NewGuid(), OrderChannel.COD)));
        Assert.True(access.CanModifyOrder(Order(userId, OrderChannel.POS)));
        Assert.False(access.CanModifyOrder(Order(Guid.NewGuid(), OrderChannel.POS)));
        Assert.True(access.CanModifyOrder(Order(Guid.NewGuid(), OrderChannel.COD)));
        Assert.False(access.CodOrdersOnly);
    }

    [Fact]
    public void Manager_or_admin_scope_allows_every_order()
    {
        var access = new OrderAccessContext(
            Guid.NewGuid(),
            CanViewAllOrders: true,
            CanViewAllCodOrders: true,
            CanViewOwnOrders: true);

        Assert.True(access.CanViewOrder(Order(Guid.NewGuid(), OrderChannel.POS)));
        Assert.True(access.CanModifyOrder(Order(Guid.NewGuid(), OrderChannel.COD)));
        Assert.Null(access.EmployeeFilter);
    }

    [Fact]
    public async Task Repository_returns_orders_of_every_creator_when_employee_filter_is_absent()
    {
        await using var db = CreateDb();
        var userId = Guid.NewGuid();
        var ownCounter = Order(userId, OrderChannel.POS);
        var otherCounter = Order(Guid.NewGuid(), OrderChannel.POS);
        var otherCod = Order(Guid.NewGuid(), OrderChannel.COD);
        db.Orders.AddRange(ownCounter, otherCounter, otherCod);
        await db.SaveChangesAsync();
        var repository = new OrderRepository(db);

        var result = await GetPaged(repository, employeeId: null, includeAllCodOrders: false);

        Assert.Equal(
            new[] { ownCounter.Id, otherCounter.Id, otherCod.Id }.OrderBy(id => id),
            result.Items.Select(item => item.Id).OrderBy(id => id));
    }

    [Fact]
    public async Task Repository_COD_channel_returns_all_COD_for_SaleCod_scope()
    {
        await using var db = CreateDb();
        var ownCounter = Order(Guid.NewGuid(), OrderChannel.POS);
        var firstCod = Order(Guid.NewGuid(), OrderChannel.COD);
        var secondCod = Order(Guid.NewGuid(), OrderChannel.COD);
        db.Orders.AddRange(ownCounter, firstCod, secondCod);
        await db.SaveChangesAsync();
        var repository = new OrderRepository(db);

        var result = await repository.GetPagedAsync(
            search: null,
            customerId: null,
            status: null,
            channel: "COD",
            excludeChannel: null,
            codTab: null,
            returnableOnly: false,
            orderKind: null,
            excludeOrderKind: null,
            fromDate: null,
            toDate: null,
            employeeId: null,
            includeAllCodOrders: false,
            page: 1,
            pageSize: 20);

        Assert.Equal(
            new[] { firstCod.Id, secondCod.Id }.OrderBy(id => id),
            result.Items.Select(item => item.Id).OrderBy(id => id));
    }

    private static OrderDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<OrderDbContext>()
            .UseInMemoryDatabase($"order-permission-tests-{Guid.NewGuid():N}")
            .Options);

    private static Task<(List<Order> Items, int TotalCount)> GetPaged(
        OrderRepository repository,
        Guid? employeeId,
        bool includeAllCodOrders) =>
        repository.GetPagedAsync(
            search: null,
            customerId: null,
            status: null,
            channel: null,
            excludeChannel: null,
            codTab: null,
            returnableOnly: false,
            orderKind: null,
            excludeOrderKind: null,
            fromDate: null,
            toDate: null,
            employeeId,
            includeAllCodOrders,
            page: 1,
            pageSize: 20);

    private static Order Order(Guid employeeId, OrderChannel channel) =>
        new()
        {
            Id = Guid.NewGuid(),
            OrderCode = $"TEST-{Guid.NewGuid():N}",
            EmployeeId = employeeId,
            OrderChannel = channel,
            OrderKind = OrderKind.Sale,
            OrderStatus = OrderStatus.Completed,
            InventorySyncStatus = InventorySyncStatus.Synced,
            CreatedAt = DateTime.UtcNow
        };
}
