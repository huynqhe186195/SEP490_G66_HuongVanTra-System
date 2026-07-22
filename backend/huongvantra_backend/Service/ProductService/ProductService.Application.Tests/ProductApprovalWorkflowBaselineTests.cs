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

    [Fact]
    public void DraftProductCreationRequestBuilder_CreatesWarehouseOwnedMultiProductDraft()
    {
        var request = ProductWorkflowTestBuilders.DraftProductCreationRequest();

        Assert.Equal(ProductCreationRequestStatus.Draft, request.Status);
        Assert.Equal(ProductWorkflowTestBuilders.WarehouseActorId, request.CreatedBy);
        Assert.Equal(2, request.Items.Count);
        Assert.All(request.Items, item => Assert.Equal(InventoryUnit.Piece.ToString(), item.InventoryUnit));
    }

    [Fact]
    public void ProductCreationRequestStatus_UsesStableWorkflowValues()
    {
        Assert.Equal(0, (int)ProductCreationRequestStatus.Draft);
        Assert.Equal(1, (int)ProductCreationRequestStatus.PendingApproval);
        Assert.Equal(2, (int)ProductCreationRequestStatus.Rejected);
        Assert.Equal(3, (int)ProductCreationRequestStatus.Completed);
        Assert.Equal(4, (int)ProductCreationRequestStatus.Cancelled);
    }

    [Fact]
    public void DraftProductDeletionRequestBuilder_CreatesWarehouseOwnedMultiProductDraft()
    {
        var request = ProductWorkflowTestBuilders.DraftProductDeletionRequest();

        Assert.Equal(ProductDeletionRequestStatus.Draft, request.Status);
        Assert.Equal(ProductWorkflowTestBuilders.WarehouseActorId, request.CreatedBy);
        Assert.Equal(2, request.Items.Count);
        Assert.All(request.Items, item => Assert.Equal("not_validated", item.ValidationStatus));
    }

    [Fact]
    public void ProductDeletionRequestStatus_UsesStableWorkflowValues()
    {
        Assert.Equal(0, (int)ProductDeletionRequestStatus.Draft);
        Assert.Equal(1, (int)ProductDeletionRequestStatus.PendingApproval);
        Assert.Equal(2, (int)ProductDeletionRequestStatus.Rejected);
        Assert.Equal(3, (int)ProductDeletionRequestStatus.Completed);
        Assert.Equal(4, (int)ProductDeletionRequestStatus.Cancelled);
    }
}
