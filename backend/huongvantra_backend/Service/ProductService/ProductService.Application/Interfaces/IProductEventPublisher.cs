namespace ProductService.Application.Interfaces;

public interface IProductEventPublisher
{
    Task PublishSkuCreatedAsync(Guid skuId, string skuCode, int weightInGrams);
}
