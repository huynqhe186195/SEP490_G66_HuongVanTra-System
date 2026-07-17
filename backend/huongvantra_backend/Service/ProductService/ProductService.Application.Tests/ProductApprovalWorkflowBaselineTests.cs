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
    public void CurrentProductTypeEnum_DocumentsPreBatchOneBaseline()
    {
        var values = Enum.GetNames<ProductType>();

        Assert.Contains(nameof(ProductType.THANH_PHAM), values);
        Assert.Contains(nameof(ProductType.NGUYEN_LIEU), values);
        Assert.DoesNotContain("BAO_BI", values);
    }
}
