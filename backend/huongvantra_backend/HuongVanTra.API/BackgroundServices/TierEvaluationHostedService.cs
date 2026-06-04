using HuongVanTra.Service.Customers;

namespace HuongVanTra.API.BackgroundServices {
    public class TierEvaluationHostedService : BackgroundService {
        private readonly IServiceScopeFactory _scopeFactory;

        public TierEvaluationHostedService(IServiceScopeFactory scopeFactory) {
            _scopeFactory = scopeFactory;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
            while (!stoppingToken.IsCancellationRequested) {

                using (var scope = _scopeFactory.CreateScope()) {
                    var customerService = scope.ServiceProvider.GetRequiredService<ICustomerService>();
                    await customerService.EvaluateAndAutoUpgradeTiersAsync();
                }

                await Task.Delay(TimeSpan.FromHours(24), stoppingToken); // interval: 24 hours
            }
        }
    }
}