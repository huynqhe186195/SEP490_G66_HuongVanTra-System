using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OrderService.Application.Options;
using OrderService.Application.UseCases;

namespace OrderService.Infrastructure.Messaging;

/// <summary>
/// G5.4 — BackgroundService bọc <see cref="OutboxDispatchProcessor"/> thành vòng lặp poll.
///
/// - Tạo một DI scope mới cho mỗi lô để có <c>OrderDbContext</c> riêng (scoped).
/// - Khi có message đã xử lý (batch &gt; 0) thì poll ngay lô kế tiếp để giải phóng backlog;
///   khi nhàn rỗi (batch == 0) thì chờ <c>PollingIntervalMs</c>.
/// - Tôn trọng graceful shutdown qua CancellationToken; nuốt lỗi vòng lặp để dispatcher
///   không chết vì một sự cố tạm thời (ví dụ broker/DB chớp nhoáng).
/// </summary>
public sealed class OutboxDispatcherHostedService(
    IServiceScopeFactory _scopeFactory,
    IOptions<OutboxDispatcherOptions> _options,
    ILogger<OutboxDispatcherHostedService> _logger)
    : BackgroundService
{
    private readonly OutboxDispatcherOptions _cfg = _options.Value;
    private readonly string _workerId = ResolveWorkerId(_options.Value.WorkerId);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_cfg.Enabled)
        {
            _logger.LogInformation("Outbox dispatcher is disabled by configuration; not starting.");
            return;
        }

        _logger.LogInformation(
            "Outbox dispatcher started. Worker={WorkerId} BatchSize={BatchSize} PollMs={PollMs}.",
            _workerId, _cfg.BatchSize, _cfg.PollingIntervalMs);

        var idleDelay = TimeSpan.FromMilliseconds(Math.Max(100, _cfg.PollingIntervalMs));

        while (!stoppingToken.IsCancellationRequested)
        {
            var processed = 0;
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var processor = scope.ServiceProvider.GetRequiredService<OutboxDispatchProcessor>();
                processed = await processor.ProcessBatchAsync(_workerId, DateTime.UtcNow, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Outbox dispatcher batch failed; will retry after delay.");
            }

            // Còn backlog thì poll ngay; nhàn rỗi thì chờ chu kỳ.
            if (processed == 0)
            {
                try
                {
                    await Task.Delay(idleDelay, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
            }
        }

        _logger.LogInformation("Outbox dispatcher stopped. Worker={WorkerId}.", _workerId);
    }

    private static string ResolveWorkerId(string? configured)
    {
        if (!string.IsNullOrWhiteSpace(configured))
            return configured.Trim();

        string host;
        try
        {
            host = Dns.GetHostName();
        }
        catch
        {
            host = Environment.MachineName;
        }

        return $"{host}:{Guid.NewGuid():N}";
    }
}
