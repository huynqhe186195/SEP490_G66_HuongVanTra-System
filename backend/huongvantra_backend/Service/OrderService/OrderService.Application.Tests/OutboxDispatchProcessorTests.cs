using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Application.UseCases;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using Xunit;

namespace OrderService.Application.Tests;

/// <summary>
/// G5 — kiểm chứng lõi Outbox Dispatcher (<see cref="OutboxDispatchProcessor"/>):
/// publish thành công → Published; lỗi tạm thời → ScheduleRetry với exponential backoff;
/// poison (permanent) → Failed ngay; vượt MaxRetry → Failed; huỷ → dừng an toàn.
/// Dùng test double cho store/publisher để tách khỏi MySQL và broker.
/// </summary>
public sealed class OutboxDispatchProcessorTests
{
    private static OutboxDispatchProcessor NewProcessor(
        IOutboxStore store,
        IOutboxMessagePublisher publisher,
        OutboxDispatcherOptions? options = null)
    {
        var cfg = options ?? new OutboxDispatcherOptions
        {
            BatchSize = 20,
            MaxRetryCount = 5,
            BaseRetryDelaySeconds = 5,
            MaxRetryDelaySeconds = 300,
            LockDurationSeconds = 60
        };

        return new OutboxDispatchProcessor(
            store,
            publisher,
            Microsoft.Extensions.Options.Options.Create(cfg),
            NullLogger<OutboxDispatchProcessor>.Instance);
    }

    private static OutboxMessage NewMessage(int retryCount = 0) => new()
    {
        Id = Guid.NewGuid(),
        EventType = "HuongVanTra.Shared.Messages.OrderPlacedEvent",
        AggregateId = Guid.NewGuid(),
        Payload = "{}",
        Status = OutboxMessageStatus.Pending,
        RetryCount = retryCount,
        OccurredAtUtc = DateTime.UtcNow,
        NextAttemptAtUtc = DateTime.UtcNow
    };

    [Fact]
    public async Task ProcessBatch_PublishSuccess_MarksPublished()
    {
        var msg = NewMessage();
        var store = new FakeOutboxStore(msg);
        var publisher = new FakePublisher();
        var processor = NewProcessor(store, publisher);

        var count = await processor.ProcessBatchAsync("w1", DateTime.UtcNow);

        Assert.Equal(1, count);
        Assert.Single(publisher.Published);
        Assert.Contains(msg.Id, store.Published);
        Assert.Empty(store.Retried);
        Assert.Empty(store.Failed);
    }

    [Fact]
    public async Task ProcessBatch_EmptyClaim_ReturnsZeroAndDoesNothing()
    {
        var store = new FakeOutboxStore();
        var publisher = new FakePublisher();
        var processor = NewProcessor(store, publisher);

        var count = await processor.ProcessBatchAsync("w1", DateTime.UtcNow);

        Assert.Equal(0, count);
        Assert.Empty(publisher.Published);
    }

    [Fact]
    public async Task ProcessBatch_TransientFailure_SchedulesRetryWithIncrementedCount()
    {
        var msg = NewMessage(retryCount: 0);
        var store = new FakeOutboxStore(msg);
        var publisher = new FakePublisher { Throw = () => new InvalidOperationException("broker down") };
        var processor = NewProcessor(store, publisher);

        await processor.ProcessBatchAsync("w1", DateTime.UtcNow);

        var retry = Assert.Single(store.Retried);
        Assert.Equal(msg.Id, retry.Id);
        Assert.Equal(1, retry.RetryCount);
        Assert.True(retry.NextAttemptUtc > DateTime.UtcNow);
        Assert.Empty(store.Published);
        Assert.Empty(store.Failed);
    }

    [Fact]
    public async Task ProcessBatch_PermanentFailure_MarksFailedWithoutRetry()
    {
        var msg = NewMessage();
        var store = new FakeOutboxStore(msg);
        var publisher = new FakePublisher { Throw = () => new OutboxPermanentPublishException("poison") };
        var processor = NewProcessor(store, publisher);

        await processor.ProcessBatchAsync("w1", DateTime.UtcNow);

        var failed = Assert.Single(store.Failed);
        Assert.Equal(msg.Id, failed.Id);
        Assert.Empty(store.Retried);
        Assert.Empty(store.Published);
    }

    [Fact]
    public async Task ProcessBatch_ExceedsMaxRetry_MarksFailed()
    {
        var cfg = new OutboxDispatcherOptions { MaxRetryCount = 3 };
        var msg = NewMessage(retryCount: 2); // nextRetry = 3 == MaxRetryCount
        var store = new FakeOutboxStore(msg);
        var publisher = new FakePublisher { Throw = () => new TimeoutException("still down") };
        var processor = NewProcessor(store, publisher, cfg);

        await processor.ProcessBatchAsync("w1", DateTime.UtcNow);

        var failed = Assert.Single(store.Failed);
        Assert.Equal(3, failed.RetryCount);
        Assert.Empty(store.Retried);
    }

    [Fact]
    public async Task ProcessBatch_Cancellation_StopsAndPropagates()
    {
        var store = new FakeOutboxStore(NewMessage(), NewMessage());
        var publisher = new FakePublisher();
        var processor = NewProcessor(store, publisher);
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => processor.ProcessBatchAsync("w1", DateTime.UtcNow, cts.Token));
    }

    [Theory]
    [InlineData(1, 5)]   // base * 2^0
    [InlineData(2, 10)]  // base * 2^1
    [InlineData(3, 20)]  // base * 2^2
    [InlineData(4, 40)]  // base * 2^3
    public void ComputeBackoff_GrowsExponentially(int retry, int expectedSeconds)
    {
        var store = new FakeOutboxStore();
        var processor = NewProcessor(store, new FakePublisher());

        var delay = processor.ComputeBackoff(retry);

        Assert.Equal(expectedSeconds, (int)delay.TotalSeconds);
    }

    [Fact]
    public void ComputeBackoff_IsCappedAtMaxDelay()
    {
        var cfg = new OutboxDispatcherOptions { BaseRetryDelaySeconds = 5, MaxRetryDelaySeconds = 30 };
        var processor = NewProcessor(new FakeOutboxStore(), new FakePublisher(), cfg);

        var delay = processor.ComputeBackoff(20); // sẽ vượt trần

        Assert.Equal(30, (int)delay.TotalSeconds);
    }

    // ----- Test doubles -----

    private sealed class FakeOutboxStore : IOutboxStore
    {
        private readonly Queue<IReadOnlyList<OutboxMessage>> _batches = new();

        public FakeOutboxStore(params OutboxMessage[] batch) =>
            _batches.Enqueue(batch);

        public List<Guid> Published { get; } = new();
        public List<(Guid Id, int RetryCount, DateTime NextAttemptUtc)> Retried { get; } = new();
        public List<(Guid Id, int RetryCount)> Failed { get; } = new();

        public Task<IReadOnlyList<OutboxMessage>> ClaimBatchAsync(
            string workerId, int batchSize, DateTime nowUtc, TimeSpan leaseDuration, CancellationToken ct = default)
        {
            IReadOnlyList<OutboxMessage> result = _batches.Count > 0 ? _batches.Dequeue() : Array.Empty<OutboxMessage>();
            return Task.FromResult(result);
        }

        public Task MarkPublishedAsync(Guid id, DateTime nowUtc, CancellationToken ct = default)
        {
            Published.Add(id);
            return Task.CompletedTask;
        }

        public Task ScheduleRetryAsync(Guid id, int retryCount, DateTime nextAttemptUtc, string error, DateTime nowUtc, CancellationToken ct = default)
        {
            Retried.Add((id, retryCount, nextAttemptUtc));
            return Task.CompletedTask;
        }

        public Task MarkFailedAsync(Guid id, int retryCount, string error, DateTime nowUtc, CancellationToken ct = default)
        {
            Failed.Add((id, retryCount));
            return Task.CompletedTask;
        }
    }

    private sealed class FakePublisher : IOutboxMessagePublisher
    {
        public Func<Exception>? Throw { get; set; }
        public List<Guid> Published { get; } = new();

        public Task PublishAsync(string eventType, string payloadJson, Guid eventId, CancellationToken ct = default)
        {
            if (Throw is not null)
                throw Throw();

            Published.Add(eventId);
            return Task.CompletedTask;
        }
    }
}
