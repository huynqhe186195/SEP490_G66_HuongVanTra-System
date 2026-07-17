using ProductService.Application.Tests.TestSupport;
using ProductService.Domain.Enums;
using Xunit;

namespace ProductService.Application.Tests;

public class ProductApprovalWorkflowBaselineTests
{
    [Fact]
    public void DraftProductApprovalRequestBuilder_CreatesDraftOwnedByWarehouse()
    {
        var request = ProductWorkflowTestBuilders.DraftProductApprovalRequest();

        Assert.Equal(NewProductApprovalStatus.Draft, request.Status);
        Assert.Equal(ProductWorkflowTestBuilders.WarehouseActorId, request.RequestedBy);
        Assert.Equal(ProductType.THANH_PHAM.ToString(), request.ProductType);
    }

    [Fact]
    public void ProductTypeEnum_UsesStableCurrentBusinessValues()
    {
        Assert.Equal(0, (int)ProductType.THANH_PHAM);
        Assert.Equal(1, (int)ProductType.NGUYEN_LIEU);
        Assert.Equal(2, (int)ProductType.BAO_BI);
    }
}
