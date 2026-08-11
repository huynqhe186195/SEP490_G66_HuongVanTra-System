using System.Text.Json;
using CustomerService.Application.Interfaces;
using CustomerService.Domain.Entities;
using CustomerService.Infrastructure.Data;
using HuongVanTra.Shared.Messages;

namespace CustomerService.Infrastructure.Repositories;

public sealed class CustomerOutboxWriter(CustomerDbContext db) : ICustomerOutboxWriter
{
    public Task EnqueueAsync(CustomerTierUpgradedEvent message, CancellationToken ct = default)
    {
        db.CustomerOutboxMessages.Add(new CustomerOutboxMessage
        {
            Id = message.EventId, EventType = typeof(CustomerTierUpgradedEvent).FullName!,
            AggregateId = message.CustomerId, Payload = JsonSerializer.Serialize(message),
            OccurredAtUtc = message.OccurredAtUtc, NextAttemptAtUtc = DateTime.UtcNow,
        });
        return Task.CompletedTask;
    }
}
