using OrderService.Application.UseCases;

namespace OrderService.WebAPI.Services;

public class CodReminderHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<CodReminderHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var logic = scope.ServiceProvider.GetRequiredService<CodReminderLogic>();
                var count = await logic.ProcessDueRemindersAsync(stoppingToken);
                if (count > 0)
                    logger.LogInformation("Đã xử lý {Count} nhắc COD định kỳ.", count);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "COD reminder job failed.");
            }

            await Task.Delay(TimeSpan.FromHours(6), stoppingToken);
        }
    }
}
