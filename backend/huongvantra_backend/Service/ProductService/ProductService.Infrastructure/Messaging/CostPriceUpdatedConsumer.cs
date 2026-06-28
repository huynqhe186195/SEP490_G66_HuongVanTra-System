using HuongVanTra.Shared.Messages;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.Messaging;

public class CostPriceUpdatedConsumer(ProductDbContext _db, ILogger<CostPriceUpdatedConsumer> _logger) : IConsumer<CostPriceUpdatedEvent>
{
    public async Task Consume(ConsumeContext<CostPriceUpdatedEvent> context)
    {
        var msg = context.Message;
        _logger.LogInformation("Received CostPriceUpdatedEvent for SkuId {SkuId} with new CostPrice {NewCostPrice}", msg.SkuId, msg.NewCostPrice);

        var sku = await _db.ProductVariants.FirstOrDefaultAsync(s => s.Id == msg.SkuId, context.CancellationToken);
        if (sku != null)
        {
            sku.CostPrice = msg.NewCostPrice;
            await _db.SaveChangesAsync(context.CancellationToken);
            _logger.LogInformation("Successfully updated CostPrice for SkuId {SkuId}", msg.SkuId);
        }
        else
        {
            _logger.LogWarning("SkuId {SkuId} not found when trying to update CostPrice", msg.SkuId);
        }
    }
}
