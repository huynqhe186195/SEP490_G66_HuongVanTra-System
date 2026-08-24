using Microsoft.EntityFrameworkCore;
using ProductService.Application.DTOs.Requests;
using ProductService.Domain.Entities;
using ProductService.Domain.Exceptions;
using ProductService.Infrastructure.Data;
using ProductService.Infrastructure.UseCases;
using Xunit;

namespace ProductService.Application.Tests;

public class NotificationRecipientReadStateTests
{
    [Fact]
    public async Task MarkRead_ForRoleBroadcast_ChangesOnlyCurrentUsersSummary()
    {
        await using var db = CreateDb();
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            RecipientRoleName = "Manager",
            Type = "low_stock_alert",
            Title = "Low stock",
            Body = "SKU is low",
            CreatedAt = DateTime.UtcNow,
        };
        db.Notifications.Add(notification);
        await db.SaveChangesAsync();

        var userA = new ProductApprovalActorSnapshot(Guid.NewGuid(), "User A", "Manager");
        var userB = new ProductApprovalActorSnapshot(Guid.NewGuid(), "User B", "Manager");
        var logic = new NotificationLogic(db);

        await logic.MarkReadAsync(notification.Id, userA);

        Assert.Equal(0, (await logic.GetSummaryAsync(userA)).UnreadCount);
        Assert.Equal(1, (await logic.GetSummaryAsync(userB)).UnreadCount);
        var userBPage = await logic.GetPagedAsync(new GetNotificationsRequest(), userB);
        Assert.False(Assert.Single(userBPage.Items).IsRead);
    }

    [Fact]
    public async Task MarkAllRead_DoesNotChangeAnotherUsersRecipientState()
    {
        await using var db = CreateDb();
        db.Notifications.AddRange(
            CreateRoleNotification("one"),
            CreateRoleNotification("two"));
        await db.SaveChangesAsync();

        var userA = new ProductApprovalActorSnapshot(Guid.NewGuid(), "User A", "Manager");
        var userB = new ProductApprovalActorSnapshot(Guid.NewGuid(), "User B", "Manager");
        var logic = new NotificationLogic(db);

        await logic.MarkAllReadAsync(userA);

        Assert.Equal(0, (await logic.GetSummaryAsync(userA)).UnreadCount);
        Assert.Equal(2, (await logic.GetSummaryAsync(userB)).UnreadCount);
        Assert.Equal(2, await db.NotificationRecipients.CountAsync(x => x.RecipientUserId == userA.UserId));
        Assert.Equal(0, await db.NotificationRecipients.CountAsync(x => x.RecipientUserId == userB.UserId));
    }

    [Fact]
    public async Task MarkRead_RejectsNotificationOutsideCurrentUsersRecipients()
    {
        await using var db = CreateDb();
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            RecipientRoleName = "Warehouse",
            Type = "low_stock_alert",
            Title = "Low stock",
            Body = "SKU is low",
            CreatedAt = DateTime.UtcNow,
        };
        db.Notifications.Add(notification);
        await db.SaveChangesAsync();

        var manager = new ProductApprovalActorSnapshot(Guid.NewGuid(), "Manager", "Manager");

        await Assert.ThrowsAsync<ProductValidationException>(
            () => new NotificationLogic(db).MarkReadAsync(notification.Id, manager));
        Assert.Empty(db.NotificationRecipients);
    }

    private static ProductDbContext CreateDb() => new(
        new DbContextOptionsBuilder<ProductDbContext>()
            .UseInMemoryDatabase($"notification-recipient-{Guid.NewGuid()}")
            .Options);

    private static Notification CreateRoleNotification(string suffix) => new()
    {
        Id = Guid.NewGuid(),
        RecipientRoleName = "Manager",
        Type = "low_stock_alert",
        Title = $"Low stock {suffix}",
        Body = "SKU is low",
        CreatedAt = DateTime.UtcNow,
    };
}
