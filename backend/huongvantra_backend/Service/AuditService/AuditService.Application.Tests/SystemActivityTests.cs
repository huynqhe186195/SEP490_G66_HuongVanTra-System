using AuditService.Application.DTOs;
using AuditService.Infrastructure.Data;
using AuditService.Infrastructure.UseCases;
using HuongVanTra.Shared.Audit;
using HuongVanTra.Shared.Messages;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuditService.Application.Tests;

public class SystemActivityTests
{
    [Fact]
    public async Task WriteAsync_IgnoresDuplicateEventId()
    {
        await using var db = CreateDbContext();
        var writer = new SystemActivityWriter(db);
        var activity = CreateEvent(eventId: Guid.NewGuid(), entityCode: "PO-001");

        var first = await writer.WriteAsync(activity);
        var duplicate = await writer.WriteAsync(activity);

        Assert.True(first);
        Assert.False(duplicate);
        Assert.Equal(1, await db.SystemActivityLogs.CountAsync());
    }

    [Fact]
    public async Task GetPagedAsync_FiltersAndPaginates()
    {
        await using var db = CreateDbContext();
        var writer = new SystemActivityWriter(db);

        await writer.WriteAsync(CreateEvent(
            eventId: Guid.NewGuid(),
            serviceName: "InventoryService",
            module: "inventory",
            entityCode: "PO-001"));
        await writer.WriteAsync(CreateEvent(
            eventId: Guid.NewGuid(),
            serviceName: "OrderService",
            module: "orders",
            entityCode: "ORD-001"));

        var logic = new SystemActivityLogic(db);
        var result = await logic.GetPagedAsync(new SystemActivityLogQuery(
            FromUtc: null,
            ToUtc: null,
            Actor: null,
            Role: null,
            ServiceName: "Inventory",
            Module: null,
            Action: null,
            Result: "Success",
            EntityCode: "PO",
            CorrelationId: null,
            Page: 1,
            PageSize: 10));

        Assert.Equal(1, result.TotalCount);
        Assert.Single(result.Items);
        Assert.Equal("PO-001", result.Items[0].EntityCode);
    }

    [Fact]
    public void Redact_MasksSensitiveValues()
    {
        var redacted = SensitiveDataRedactor.Redact("password=abc123 token:secret-value reason=ok");

        Assert.NotNull(redacted);
        Assert.DoesNotContain("abc123", redacted!, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("secret-value", redacted!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("[redacted]", redacted!, StringComparison.OrdinalIgnoreCase);
    }

    private static AuditDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AuditDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AuditDbContext(options);
    }

    private static SystemActivityEvent CreateEvent(
        Guid eventId,
        string serviceName = "InventoryService",
        string module = "inventory",
        string? entityCode = null)
    {
        return new SystemActivityEvent(
            eventId,
            DateTime.UtcNow,
            Guid.NewGuid(),
            "Admin User",
            "Admin",
            serviceName,
            module,
            "POST /api/v1/inventory/production-orders",
            "production-orders",
            null,
            entityCode,
            "POST /api/v1/inventory/production-orders completed with HTTP 200.",
            "Success",
            null,
            null,
            null,
            Guid.NewGuid().ToString("N"),
            "/api/v1/inventory/production-orders",
            "POST",
            200,
            "127.0.0.1",
            "test-agent");
    }
}
