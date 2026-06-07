using MassTransit;
using Microsoft.Extensions.Logging;
using ProductService.Application.Interfaces;

namespace ProductService.Infrastructure.Messaging;

public record SkuCreatedEvent(Guid SkuId, string SkuCode, int WeightInGrams);

public class ProductEventPublisher(
    IPublishEndpoint _publishEndpoint,
    ILogger<ProductEventPublisher> _logger) : IProductEventPublisher
{
    public async Task PublishSkuCreatedAsync(Guid skuId, string skuCode, int weightInGrams)
    {
        var message = new SkuCreatedEvent(skuId, skuCode, weightInGrams);
        await _publishEndpoint.Publish(message);
        _logger.LogInformation(
            "Published SkuCreatedEvent SkuId={SkuId} SkuCode={SkuCode} WeightInGrams={WeightInGrams}",
            skuId, skuCode, weightInGrams);
    }
}
