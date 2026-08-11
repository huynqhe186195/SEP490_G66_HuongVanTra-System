using HuongVanTra.Shared.Messages;

namespace CustomerService.Application.Interfaces;

public interface ICustomerOutboxWriter
{
    Task EnqueueAsync(CustomerTierUpgradedEvent message, CancellationToken ct = default);
}
