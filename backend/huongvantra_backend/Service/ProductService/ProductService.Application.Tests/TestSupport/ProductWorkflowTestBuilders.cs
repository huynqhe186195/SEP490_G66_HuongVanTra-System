using ProductService.Domain.Entities;
using ProductService.Domain.Enums;

namespace ProductService.Application.Tests.TestSupport;

public static class ProductWorkflowTestBuilders
{
    public static Guid WarehouseActorId { get; } = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static Guid AdminActorId { get; } = Guid.Parse("22222222-2222-2222-2222-222222222222");

    public static NewProductApprovalRequest DraftProductApprovalRequest(
        string approvalCode = "PA-BASELINE-0001",
        string productName = "Baseline product")
    {
        return new NewProductApprovalRequest
        {
            Id = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            ApprovalCode = approvalCode,
            Status = NewProductApprovalStatus.Draft,
            ProductName = productName,
            ProductType = ProductType.THANH_PHAM.ToString(),
            ProductSnapshotJson = "{}",
            RequestedBy = WarehouseActorId,
            RequestedByName = "Warehouse Tester",
            RequestedByRoleName = "Warehouse",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public static ProductCreationRequest DraftProductCreationRequest(int itemCount = 2)
    {
        var request = new ProductCreationRequest
        {
            Id = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            RequestCode = "PCR-BASELINE-0001",
            Title = "Baseline multi-product request",
            Status = ProductCreationRequestStatus.Draft,
            CreatedBy = WarehouseActorId,
            CreatedByName = "Warehouse Tester",
            CreatedByRoleName = "Warehouse",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        for (var i = 1; i <= itemCount; i++)
        {
            request.Items.Add(new ProductCreationRequestItem
            {
                Id = Guid.Parse($"dddddddd-dddd-dddd-dddd-dddddddddd{i:00}"),
                RequestId = request.Id,
                ClientKey = $"item-{i}",
                SortOrder = i - 1,
                ProductSnapshotJson = "{}",
                ProductName = $"Baseline product {i}",
                ProductType = ProductType.THANH_PHAM.ToString(),
                BaseUnit = "unit",
                InventoryUnit = InventoryUnit.Piece.ToString(),
                VariantCount = 1,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }

        return request;
    }

    public static Product ShelfProduct(Guid? id = null, string name = "Baseline finished product")
    {
        return new Product
        {
            Id = id ?? Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            CategoryId = 1,
            Name = name,
            ProductType = ProductType.THANH_PHAM,
            BaseUnit = "unit",
            InventoryUnit = InventoryUnit.Piece,
            IsActive = true,
            IsVariantParent = true,
        };
    }
}
