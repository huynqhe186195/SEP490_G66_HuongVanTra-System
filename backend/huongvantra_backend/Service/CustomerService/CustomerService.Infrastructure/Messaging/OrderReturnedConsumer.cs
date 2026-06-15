using CustomerService.Application.UseCases;
using HuongVanTra.Shared.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace CustomerService.Infrastructure.Messaging;

public class OrderReturnedConsumer : IConsumer<OrderReturnedEvent>
{
    private readonly CustomerLogic _customerLogic;
    private readonly ILogger<OrderReturnedConsumer> _logger;

    public OrderReturnedConsumer(CustomerLogic customerLogic, ILogger<OrderReturnedConsumer> logger)
    {
        _customerLogic = customerLogic;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<OrderReturnedEvent> context)
    {
        var msg = context.Message;

        _logger.LogInformation(
            "Received OrderReturnedEvent {ReturnCode} ({ReturnId}) for order {OrderCode}",
            msg.ReturnCode, msg.ReturnId, msg.OrderCode);

        var result = await _customerLogic.HandleOrderReturnedAsync(
            msg.ReturnId,
            msg.ReturnCode,
            msg.OrderId,
            msg.OrderCode,
            msg.CustomerId,
            msg.ReturnAmount,
            msg.OrderFinalAmount,
            msg.RefundAmount,
            context.CancellationToken);

        if (result.SkippedDuplicate)
        {
            _logger.LogInformation("Return {ReturnId} already processed — skipped", msg.ReturnId);
            return;
        }

        if (result.SkippedNoCustomer)
        {
            _logger.LogInformation("Return {ReturnId} has no customer — skipped", msg.ReturnId);
            return;
        }

        if (result.CustomerNotFound)
        {
            _logger.LogWarning(
                "Customer {CustomerId} not found for return {ReturnId} — message will be retried",
                msg.CustomerId, msg.ReturnId);
            throw new InvalidOperationException($"Customer '{msg.CustomerId}' not found.");
        }

        _logger.LogInformation(
            "Updated customer {CustomerId} after return: spending -{SpendingReduced}, debt -{DebtReduced}, totalSpending={TotalSpending}, debt={CurrentDebt}",
            result.CustomerId, result.SpendingReduced, result.DebtReduced, result.TotalSpending, result.CurrentDebt);
    }
}
