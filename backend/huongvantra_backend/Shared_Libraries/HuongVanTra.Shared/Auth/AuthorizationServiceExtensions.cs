using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace HuongVanTra.Shared.Auth;

public static class AuthorizationServiceExtensions
{
    public static IServiceCollection AddHvtPermissionPolicies(this IServiceCollection services)
    {
        services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();
        services.AddSingleton<IAuthorizationHandler, AnyPermissionAuthorizationHandler>();

        services.AddAuthorization(options =>
        {
            foreach (var permission in PermissionNames.All)
            {
                options.AddPolicy(permission, policy =>
                    policy.Requirements.Add(new PermissionRequirement(permission)));
            }

            options.AddPolicy(PermissionNames.CatalogManagement, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ManageCatalog)));

            options.AddPolicy(PermissionNames.ViewCustomerAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ViewCustomer,
                    PermissionNames.ViewAllCustomers,
                    PermissionNames.ManageRole)));

            options.AddPolicy(PermissionNames.EditCustomerProfile, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.CreateCustomer,
                    PermissionNames.CreateOrder,
                    PermissionNames.ManageCorporateCustomer)));

            options.AddPolicy(PermissionNames.CreateCustomerProfile, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.CreateCustomer,
                    PermissionNames.ManageCorporateCustomer,
                    PermissionNames.CreateOrder)));

            options.AddPolicy(PermissionNames.ApplyDebtPayment, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.CreateOrder,
                    PermissionNames.CreateCustomer)));

            // Yêu cầu bổ sung Kệ Hàng: Manager tạo (CREATE_SHELF_REPLENISHMENT / legacy MANAGE_EMPLOYEE);
            // Warehouse/Admin vẫn xem qua VIEW_INVENTORY. Quyền xem của Sale được giữ cho dữ liệu lịch sử.
            options.AddPolicy(PermissionNames.StockAdjustmentReadAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ViewInventory,
                    PermissionNames.ManageEmployee,
                    PermissionNames.CreatePosOrder,
                    PermissionNames.CreateShelfReplenishment,
                    PermissionNames.ApproveShelfReplenishment)));

            options.AddPolicy(PermissionNames.StockAdjustmentCreateAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ManageEmployee,
                    PermissionNames.CreateShelfReplenishment)));

            options.AddPolicy(PermissionNames.ShelfReplenishmentApproveAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.OperateWarehouse,
                    PermissionNames.ApproveShelfReplenishment)));

            // Kiểm kê: Sale quầy / Manager / Thủ kho (kiểm kê Kho tổng) — vị trí siết ở controller.
            options.AddPolicy(PermissionNames.StocktakeCreateAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.CreatePosOrder,
                    PermissionNames.ManageEmployee,
                    PermissionNames.OperateWarehouse)));

            options.AddPolicy(PermissionNames.ViewCatalogAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ViewCatalog)));

            // Lập hợp đồng B2B cần thấy cả nguyên liệu/bao bì — không phụ thuộc role Thủ kho.
            options.AddPolicy(PermissionNames.ContractCatalogAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ManageCorporateCustomer,
                    PermissionNames.CreateB2BOrder,
                    PermissionNames.ApproveContract)));

            options.AddPolicy(PermissionNames.WarehouseOrManagerOps, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.OperateWarehouse,
                    PermissionNames.ApproveInventory)));

            options.AddPolicy(PermissionNames.MaterialsDeductAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.OperateWarehouse,
                    PermissionNames.ApproveInventory,
                    PermissionNames.RejectStockDeduct,
                    PermissionNames.ManageRole)));

            options.AddPolicy(PermissionNames.CancelRetailPriceAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ApprovePrice,
                    PermissionNames.ManageCost)));

            options.AddPolicy(PermissionNames.ManageSupplierProductAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ManageSupplierProduct,
                    PermissionNames.ManageSuppliers)));

            options.AddPolicy(PermissionNames.ReturnInspectionAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.PerformReturnInspection,
                    PermissionNames.OperateWarehouse)));

            options.AddPolicy(PermissionNames.ManageShelfStockThresholdAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ManageStockThreshold,
                    PermissionNames.ApproveInventory)));

            options.AddPolicy(PermissionNames.ManageWarehouseStockThresholdAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ManageStockThreshold,
                    PermissionNames.OperateWarehouse)));

            options.AddPolicy(PermissionNames.ShipOrderAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.CreateOrder,
                    PermissionNames.ShipOrder)));

            options.AddPolicy(PermissionNames.ViewMembershipTierAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ViewCustomer,
                    PermissionNames.ViewAllCustomers,
                    PermissionNames.ManageRole,
                    PermissionNames.ManageBusinessPolicy,
                    PermissionNames.CreateCustomer,
                    PermissionNames.CreateOrder,
                    PermissionNames.CreatePosOrder,
                    PermissionNames.CreateCodOrder,
                    PermissionNames.ManageCorporateCustomer)));

            options.AddPolicy(PermissionNames.ManageMembershipTierAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ManageBusinessPolicy,
                    PermissionNames.CreateCustomer,
                    PermissionNames.ManageRole)));

            options.AddPolicy(PermissionNames.ManageTaxonomyAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ManageTaxonomy,
                    PermissionNames.ManageCatalog)));

            options.AddPolicy(PermissionNames.UpdateAccountingRetailPriceAccess, policy =>
                policy.Requirements.Add(new AnyPermissionRequirement(
                    PermissionNames.ManageCatalog,
                    PermissionNames.ManageCost)));
        });

        return services;
    }
}
