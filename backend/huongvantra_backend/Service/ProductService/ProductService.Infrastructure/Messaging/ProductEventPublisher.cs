using MassTransit;
using ProductService.Application.Interfaces;

namespace ProductService.Infrastructure.Messaging;

public record SkuCreatedEvent(Guid SkuId, string SkuCode, int WeightInGrams);

public class ProductEventPublisher(IPublishEndpoint _publishEndpoint) : IProductEventPublisher
{
    public async Task PublishSkuCreatedAsync(Guid skuId, string skuCode, int weightInGrams)
    {
        await _publishEndpoint.Publish(new SkuCreatedEvent(skuId, skuCode, weightInGrams));
    }
}
