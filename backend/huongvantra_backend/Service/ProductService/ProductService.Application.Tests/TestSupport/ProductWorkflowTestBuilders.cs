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

    public static Product ShelfProduct(Guid? id = null, string name = "Baseline finished product")
    {
        return new Product
        {
            Id = id ?? Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            CategoryId = 1,
            Name = name,
            ProductType = ProductType.THANH_PHAM,
            BaseUnit = "unit",
            IsActive = true,
            IsVariantParent = true,
        };
    }
}
