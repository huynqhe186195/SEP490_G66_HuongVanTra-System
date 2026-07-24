using MassTransit;
using Moq;
using OrderService.Application.Interfaces;
using OrderService.Infrastructure.Messaging;
using HuongVanTra.Shared.Messages;
using Xunit;

namespace OrderService.Application.Tests;

/// <summary>
/// G5.3 — kiểm chứng MassTransitOutboxMessagePublisher và OutboxEventTypeRegistry:
/// allowlist chặn type lạ (poison), payload hỏng → poison, và publish đúng CLR type
/// giữ nguyên EventId để consumer chống trùng.
/// </summary>
public sealed class OutboxMessagePublisherTests
{
    private static string PlacedPayload(Guid eventId, Guid orderId) =>
        $$"""
        {"eventId":"{{eventId}}","occurredAtUtc":"2026-07-24T00:00:00Z","orderId":"{{orderId}}","orderCode":"HVT-1","orderStatus":"Completed","totalAmount":10000,"items":[]}
        """;

    [Fact]
    public async Task PublishAsync_ValidPlacedEvent_PublishesResolvedTypeWithEventId()
    {
        var eventId = Guid.NewGuid();
        var orderId = Guid.NewGuid();
        var endpoint = new Mock<IPublishEndpoint>();
        OrderPlacedEvent? captured = null;
        endpoint
            .Setup(e => e.Publish(It.IsAny<object>(), It.IsAny<Type>(), It.IsAny<CancellationToken>()))
            .Callback<object, Type, CancellationToken>((m, _, _) => captured = m as OrderPlacedEvent)
            .Returns(Task.CompletedTask);

        var publisher = new MassTransitOutboxMessagePublisher(endpoint.Object);

        await publisher.PublishAsync(
            typeof(OrderPlacedEvent).FullName!, PlacedPayload(eventId, orderId), eventId);

        Assert.NotNull(captured);
        Assert.Equal(eventId, captured!.EventId);
        Assert.Equal(orderId, captured.OrderId);
        endpoint.Verify(e => e.Publish(
            It.IsAny<object>(), typeof(OrderPlacedEvent), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PublishAsync_UnknownEventType_ThrowsPermanentAndDoesNotPublish()
    {
        var endpoint = new Mock<IPublishEndpoint>();
        var publisher = new MassTransitOutboxMessagePublisher(endpoint.Object);

        await Assert.ThrowsAsync<OutboxPermanentPublishException>(
            () => publisher.PublishAsync("Some.Evil.Type", "{}", Guid.NewGuid()));

        endpoint.Verify(e => e.Publish(
            It.IsAny<object>(), It.IsAny<Type>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task PublishAsync_MalformedPayload_ThrowsPermanent()
    {
        var endpoint = new Mock<IPublishEndpoint>();
        var publisher = new MassTransitOutboxMessagePublisher(endpoint.Object);

        await Assert.ThrowsAsync<OutboxPermanentPublishException>(
            () => publisher.PublishAsync(
                typeof(OrderPlacedEvent).FullName!, "{ this is not json", Guid.NewGuid()));
    }

    [Theory]
    [InlineData(typeof(OrderPlacedEvent))]
    [InlineData(typeof(OrderCompletedEvent))]
    [InlineData(typeof(OrderCancelledEvent))]
    [InlineData(typeof(OrderReturnedEvent))]
    [InlineData(typeof(OrderShippedEvent))]
    public void Registry_ResolvesKnownEventTypes(Type type)
    {
        Assert.True(OutboxEventTypeRegistry.TryResolve(type.FullName!, out var resolved));
        Assert.Equal(type, resolved);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("System.String")]
    [InlineData("HuongVanTra.Shared.Messages.NotARealEvent")]
    public void Registry_RejectsUnknownOrEmptyTypes(string eventType)
    {
        Assert.False(OutboxEventTypeRegistry.TryResolve(eventType, out _));
    }

    [Fact]
    public void Registry_KnownEventTypes_ContainsAllContracts()
    {
        Assert.Contains(typeof(OrderPlacedEvent).FullName, OutboxEventTypeRegistry.KnownEventTypes);
        Assert.Contains(typeof(OrderReturnedEvent).FullName, OutboxEventTypeRegistry.KnownEventTypes);
        Assert.Contains(typeof(OrderShippedEvent).FullName, OutboxEventTypeRegistry.KnownEventTypes);
        Assert.Equal(5, OutboxEventTypeRegistry.KnownEventTypes.Count);
    }
}
