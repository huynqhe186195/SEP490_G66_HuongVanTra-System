using CustomerService.Application.UseCases;
using HuongVanTra.Shared.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace CustomerService.Infrastructure.Messaging;

public class OrderCompletedConsumer : IConsumer<OrderCompletedEvent>
{
    private readonly CustomerLogic _customerLogic;
    private readonly ILogger<OrderCompletedConsumer> _logger;

    public OrderCompletedConsumer(CustomerLogic customerLogic, ILogger<OrderCompletedConsumer> logger)
    {
        _customerLogic = customerLogic;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<OrderCompletedEvent> context)
    {
        var msg = context.Message;

        _logger.LogInformation(
            "Received OrderCompletedEvent {OrderCode} ({OrderId}) for customer {CustomerId}",
            msg.OrderCode, msg.OrderId, msg.CustomerId);

        var result = await _customerLogic.HandleOrderCompletedAsync(
            msg.OrderId,
            msg.OrderCode,
            msg.CustomerId,
            msg.TotalAmount,
            msg.DebtAmount,
            msg.CodDebtSettlementJson,
            context.CancellationToken);

        if (result.SkippedDuplicate)
        {
            _logger.LogInformation("Order {OrderId} already processed — skipped", msg.OrderId);
            return;
        }

        if (result.CustomerNotFound)
        {
            _logger.LogWarning(
                "Customer {CustomerId} not found for order {OrderId} — message will be retried",
                msg.CustomerId, msg.OrderId);
            throw new InvalidOperationException($"Customer '{msg.CustomerId}' not found.");
        }

        _logger.LogInformation(
            "Updated customer {CustomerId}: spending={TotalSpending}, debt={CurrentDebt}, tier={TierName}, upgraded={TierUpgraded}",
            result.CustomerId, result.TotalSpending, result.CurrentDebt, result.TierName, result.TierUpgraded);

    }
}
