using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;

namespace OrderService.Application.UseCases;

/// <summary>
/// G5 — lõi xử lý Outbox Dispatcher, tách khỏi BackgroundService để kiểm thử được.
///
/// Một vòng xử lý:
/// 1. Claim một lô message (nguyên tử, có lease) qua <see cref="IOutboxStore"/>.
/// 2. Với mỗi message: publish qua <see cref="IOutboxMessagePublisher"/> NGOÀI transaction DB.
/// 3. Thành công → MarkPublished. Lỗi tạm thời → ScheduleRetry với exponential backoff.
///    Vượt MaxRetry hoặc lỗi vĩnh viễn (poison) → MarkFailed.
///
/// Lưu ý: không giữ transaction DB mở trong lúc publish broker (claim và cập nhật
/// trạng thái là hai thao tác tách biệt) để tránh giữ lock lâu.
/// </summary>
public sealed class OutboxDispatchProcessor(
    IOutboxStore _store,
    IOutboxMessagePublisher _publisher,
    IOptions<OutboxDispatcherOptions> _options,
    ILogger<OutboxDispatchProcessor> _logger)
{
    private readonly OutboxDispatcherOptions _cfg = _options.Value;

    /// <summary>Xử lý đúng một lô. Trả về số message đã claim (0 nghĩa là nhàn rỗi).</summary>
    public async Task<int> ProcessBatchAsync(string workerId, DateTime nowUtc, CancellationToken ct = default)
    {
        var lease = TimeSpan.FromSeconds(Math.Max(1, _cfg.LockDurationSeconds));
        var batch = await _store.ClaimBatchAsync(workerId, Math.Max(1, _cfg.BatchSize), nowUtc, lease, ct);
        if (batch.Count == 0)
            return 0;

        foreach (var message in batch)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                await _publisher.PublishAsync(message.EventType, message.Payload, message.Id, ct);
                await _store.MarkPublishedAsync(message.Id, DateTime.UtcNow, ct);

                _logger.LogInformation(
                    "Outbox published {EventType} {EventId} (aggregate {AggregateId}) after {Retry} retries.",
                    message.EventType, message.Id, message.AggregateId, message.RetryCount);
            }
            catch (OutboxPermanentPublishException ex)
            {
                await _store.MarkFailedAsync(message.Id, message.RetryCount, Trim(ex.Message), DateTime.UtcNow, ct);
                _logger.LogError(
                    "Outbox message {EventId} of type {EventType} is permanently failed (poison): {Error}",
                    message.Id, message.EventType, ex.Message);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                var nextRetry = message.RetryCount + 1;
                if (nextRetry >= _cfg.MaxRetryCount)
                {
                    await _store.MarkFailedAsync(message.Id, nextRetry, Trim(ex.Message), DateTime.UtcNow, ct);
                    _logger.LogError(
                        "Outbox message {EventId} exceeded max retries ({Max}); marked Failed. Last error: {Error}",
                        message.Id, _cfg.MaxRetryCount, ex.Message);
                }
                else
                {
                    var delay = ComputeBackoff(nextRetry);
                    var nextAttempt = DateTime.UtcNow.Add(delay);
                    await _store.ScheduleRetryAsync(message.Id, nextRetry, nextAttempt, Trim(ex.Message), DateTime.UtcNow, ct);
                    _logger.LogWarning(
                        "Outbox message {EventId} publish failed (attempt {Attempt}/{Max}); retry at {NextAttempt}. Error: {Error}",
                        message.Id, nextRetry, _cfg.MaxRetryCount, nextAttempt, ex.Message);
                }
            }
        }

        return batch.Count;
    }

    /// <summary>
    /// Bounded exponential backoff: base * 2^(retry-1), giới hạn bởi MaxRetryDelaySeconds.
    /// </summary>
    public TimeSpan ComputeBackoff(int retryCount)
    {
        var baseSeconds = Math.Max(1, _cfg.BaseRetryDelaySeconds);
        var maxSeconds = Math.Max(baseSeconds, _cfg.MaxRetryDelaySeconds);

        // Dùng double và chặn trần trước khi ép về giây để tránh tràn số.
        var exponent = Math.Max(0, retryCount - 1);
        var scaled = baseSeconds * Math.Pow(2, exponent);
        var seconds = scaled >= maxSeconds ? maxSeconds : (int)scaled;
        return TimeSpan.FromSeconds(seconds);
    }

    private static string Trim(string error) =>
        string.IsNullOrEmpty(error) ? "Unknown error"
        : error.Length <= 1000 ? error
        : error[..1000];
}
