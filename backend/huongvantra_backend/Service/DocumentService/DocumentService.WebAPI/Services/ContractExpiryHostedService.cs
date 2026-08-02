using DocumentService.Application.Interfaces;

namespace DocumentService.WebAPI.Services;

public class ContractExpiryHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<ContractExpiryHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var repository = scope.ServiceProvider.GetRequiredService<IContractRepository>();
                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                var count = await repository.ExpireOutdatedContractsAsync(today, stoppingToken);
                if (count > 0)
                    logger.LogInformation("Đã chuyển {Count} hợp đồng quá hạn sang Expired.", count);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Contract expiry job failed.");
            }

            await Task.Delay(TimeSpan.FromHours(12), stoppingToken);
        }
    }
}
