using CustomerService.Application.Messages;
using CustomerService.Application.UseCases;
using MassTransit;

namespace CustomerService.Infrastructure.Messaging;

public class OrderCompletedConsumer : IConsumer<OrderCompletedEvent>
{
    private readonly CustomerLogic _customerLogic;

    public OrderCompletedConsumer(CustomerLogic customerLogic)
    {
        _customerLogic = customerLogic;
    }

    public async Task Consume(ConsumeContext<OrderCompletedEvent> context)
    {
        var msg = context.Message;
        await _customerLogic.HandleOrderCompletedAsync(
            msg.CustomerId,
            msg.TotalAmount,
            msg.DebtAmount,
            context.CancellationToken);
    }
}
