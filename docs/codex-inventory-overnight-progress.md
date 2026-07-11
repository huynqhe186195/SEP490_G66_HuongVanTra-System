# Codex Inventory Overnight Progress

## Current Phase

- Phase 0 - Safety, baseline, and source inspection.

## Completed Phases

- None yet.

## Pending Phases

- Phase 1 - Complete Flow 2A: sell-first, deduct branch/counter stock later.
- Phase 2 - New Product Creation Approval for `/inventory/products/create`.
- Phase 3 - Role and wording cleanup across Inventory.
- Phase 4 - Integration stabilization and regression checks.
- Phase 5 - Final report.

## Branch And Working Tree

- Branch: `HuyTD`
- Initial working tree: clean.
- Recent commits:
  - `18e7438 Merge remote-tracking branch 'origin/HuyNQ-06' into HuyTD`
  - `c5693c3 fix customer type display error`
  - `f008fcb fix conflict and merge code`
  - `262ef6b Update inventory`
  - `cb35160 Merge branch 'main' into HuyNQ-06`

## Phase 0 Inspection Summary

### StockDeductQueue / Flow 2A

Detected backend source:

- `Service/InventoryService/InventoryService.Domain/Entities/StockDeductQueue.cs`
- `Service/InventoryService/InventoryService.Domain/Entities/StockDeductQueueItem.cs`
- `Service/InventoryService/InventoryService.Domain/Enums/QueueStatus.cs`
- `Service/InventoryService/InventoryService.WebAPI/Controllers/StockDeductQueueController.cs`
- `Service/InventoryService/InventoryService.Infrastructure/Repositories/StockDeductQueueRepository.cs`
- `Service/InventoryService/InventoryService.Application/UseCases/InventoryLogic.cs`
- `Service/InventoryService/InventoryService.Application/DTOs/Requests/InventoryRequests.cs`
- `Service/InventoryService/InventoryService.Application/DTOs/Responses/InventoryResponses.cs`
- `Service/InventoryService/InventoryService.Infrastructure/Data/Configurations/InventoryConfigurations.cs`
- `Shared_Libraries/HuongVanTra.Shared/Messages/OrderPlacedEvent.cs`
- `Shared_Libraries/HuongVanTra.Shared/Messages/StockDeductedEvent.cs`
- `Service/OrderService/OrderService.Infrastructure/Messaging/StockDeductedConsumer.cs`
- `Service/OrderService/OrderService.Application/UseCases/OrderLogic.cs`
- `Service/OrderService/OrderService.Domain/Enums/OrderEnums.cs`

Current behavior observed from source:

- `OrderPlacedEvent` creates `StockDeductQueue` with `QueueStatus.Waiting`.
- Existing `QueueStatus` only has `Waiting`, `Confirmed`, `Cancelled`.
- `StockDeductQueueController` currently protects list/preview/confirm/cancel with `PermissionNames.ViewOrder`.
- `StockDeductQueueRepository` currently returns only `QueueStatus.Waiting`; the `status` query parameter is ignored in controller.
- `PreviewQueueAsync` calculates shortage against `SkuStock.QuantityOnHand`.
- `ConfirmQueueAsync` deducts `SkuStock.QuantityOnHand`, not `WarehouseQuantityOnHand`.
- If stock is insufficient, `ConfirmQueueAsync` throws `InsufficientStockException`; it does not persist an `Insufficient` queue status.
- `CancelQueueAsync` ignores `CancelStockDeductRequest.Reason`; cancel reason is not required or saved.
- Confirm/cancel audit fields such as `ConfirmedByName`, `CancelledByName`, `LastAttemptAt`, `LastShortageReason` do not exist on `StockDeductQueue`.
- Successful confirm publishes `StockDeductedEvent`; `OrderService` consumes it and calls `MarkInventorySyncedAsync`.
- There is no detected cancellation event back to `OrderService`, so cancelled queues may not update order inventory sync status.
- Existing `StockExportSlip` and `StockExportSlipLine` already have store before/after fields (`StoreQtyBefore`, `StoreQtyAfter`) that can support a sales deduct-later voucher without adding those specific fields.

Detected frontend source:

- `frontend/huongvantra-web-client/src/app/App.jsx`
- `frontend/huongvantra-web-client/src/app/navigation.js`
- `frontend/huongvantra-web-client/src/features/inventory/pages/StockDeductQueuePage.jsx`
- `frontend/huongvantra-web-client/src/features/inventory/components/StockDeductPreviewModal.jsx`
- `frontend/huongvantra-web-client/src/features/inventory/services/stockDeductQueueApi.js`
- `frontend/huongvantra-web-client/src/features/orders/utils/orderDisplay.js`

Current frontend behavior observed from source:

- `/orders/stock-deduct` route exists.
- Sidebar module `stock_deduct_ops` is currently in `SIDEBAR_DISABLED_MODULES`, so it is hidden from sidebar.
- `canConfirmStockDeduct()` currently allows `admin` and `inventoryManager`, not `Manager`.
- Wording still presents warehouse/Thu kho as primary actor in this flow.
- Page has partial tabs for all/waiting/insufficient, but backend does not yet honor status filtering or persist insufficient queues.
- Preview modal can call confirm but has no final confirmation modal and no cancel-reason modal.

### Product Approval / Product Creation

Detected backend source:

- `Service/ProductService/ProductService.Domain/Entities/Product.cs`
- `Service/ProductService/ProductService.Domain/Entities/ProductVariant.cs`
- `Service/ProductService/ProductService.Domain/Entities/ProductVariantBomLine.cs`
- `Service/ProductService/ProductService.Application/DTOs/Requests/ProductRequests.cs`
- `Service/ProductService/ProductService.Application/DTOs/Responses/ProductResponse.cs`
- `Service/ProductService/ProductService.Application/UseCases/ProductLogic.cs`
- `Service/ProductService/ProductService.Infrastructure/Data/ProductDbContext.cs`
- `Service/ProductService/ProductService.WebAPI/Controllers/ProductsController.cs`

Current behavior observed from source:

- No existing `ProductApproval`, `ProductApprovalRequest`, `NewProductApprovalRequest`, or `ApprovalCode` implementation was found.
- `POST /api/v1/products` currently creates products directly and is authorized with `[Authorize(Roles = "Warehouse")]`.
- Product variants/SKUs are represented by `ProductVariant`.
- BOM is stored on `ProductVariantBomLine` by `ProductVariantId`.
- `ProductLogic.CreateAsync()` validates product, units, variants, duplicate product name and duplicate variant SKU, then creates product/variants/BOM together through `ProductRepository`.
- Product response already includes `HasBom` and `BomLineCount` from real `ProductVariant.BomLines`.

Detected frontend source:

- `frontend/huongvantra-web-client/src/features/products/pages/ProductFormPage.jsx`
- `frontend/huongvantra-web-client/src/features/products/services/productsApi.js`
- `frontend/huongvantra-web-client/src/features/auth/utils/permissions.js`
- `frontend/huongvantra-web-client/src/app/App.jsx`
- `frontend/huongvantra-web-client/src/app/navigation.js`

Current frontend behavior observed from source:

- `/inventory/products/create` renders `ProductFormPage` in create mode.
- `ProductFormPage` submits directly through `createProduct()` -> `POST /api/v1/products`.
- `canCreateCatalog()` currently checks warehouse role only.
- `canManageCatalog()` allows `MANAGE_CATALOG`, `MANAGE_ROLE`, or warehouse role.
- There is no current approval-code entry step or Admin product-approval page.

### Role/Permission Baseline

- UserService seeding has roles: `Admin`, `Sale`, `Warehouse`, `Accountant`, `Manager`.
- `Warehouse` currently has `VIEW_ORDER` and `MANAGE_CATALOG`.
- `Manager` currently has `CREATE_ORDER`, `VIEW_ORDER`, `VIEW_ALL_CUSTOMERS`, `MANAGE_EMPLOYEE`, `CREATE_CUSTOMER`, `VIEW_CUSTOMER`.
- Shared `PermissionNames` includes `CREATE_ORDER`, `VIEW_ORDER`, `MANAGE_CATALOG`, `MANAGE_ROLE`, but no dedicated stock deduction confirm permission.
- Frontend role groups currently map `inventoryManager` aliases to Warehouse/Thu kho and `agencyManager` aliases to Manager.

### Migration Baseline

InventoryService latest detected migrations include:

- `20260701123000_AddStockImportSlipLines`
- `20260702120000_AddSlipCreatorSnapshots`
- `20260706120000_RefactorProductionOrdersToMultiOutput`
- `20260706123000_AddProductionOrderOutputLineExpiry`

ProductService latest detected migrations include:

- `20260614092529_AddBrandAttributeNameProductTypeBomLines`
- `20260628000000_RemoveProductSkusAddVariantSyncFields`

OrderService latest detected migrations include:

- `20260628215806_AddOrderIdempotencyKey`
- `20260629120000_AddCustomBundles`

### Gateway Baseline

- Gateway has routes for `/api/stock-deduct-queue/{**catch-all}` to `inventory-cluster`.
- Gateway has routes for `/api/v1/products` and `/api/v1/products/{**catch-all}` to ProductService.
- No product approval routes were detected.

### Docker Baseline

- `docker compose ps` from `backend/huongvantra_backend` failed because Docker Desktop / Docker API pipe was unavailable:
  - `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`
- Docker is therefore not available for Phase 0 verification in this run.

## Files Changed

- `docs/codex-inventory-overnight-progress.md`

## Migrations Added

- None in Phase 0.

## Commands Run

- `git branch --show-current` - passed, output `HuyTD`.
- `git status --short` - passed, output empty.
- `git log --oneline -5` - passed.
- `Test-Path docs\codex-inventory-overnight-progress.md` - passed, output `False`.
- `docker compose ps` from `backend/huongvantra_backend` - failed because Docker API was unavailable.
- `rg` searches for StockDeductQueue, Product Approval, routes, migrations, roles, permissions - passed.
- `Get-Content` inspections for StockDeductQueue/Product/Order/User/frontend route and service files - passed.

## Tests/Builds Run

- None in Phase 0; this phase was source inspection and progress tracker creation only.

## Tests/Builds Passed

- Not applicable for Phase 0.

## Tests/Builds Failed

- `docker compose ps` failed due Docker daemon/API unavailable, not due source build failure.

## Current Known Issues

- `/orders/stock-deduct` currently mixes role wording: UI says Thu kho/warehouse handles branch/counter deduction, but business rule requires Manager/Admin.
- `StockDeductQueueController` uses broad `ViewOrder` authorization for confirm/cancel.
- `QueueStatus.Insufficient` is missing.
- Queue status filtering is not implemented in repository/controller despite frontend passing `status`.
- Confirm insufficient stock does not persist an insufficient/waiting-stock state.
- Cancel reason is ignored and not required.
- Confirm/cancel audit fields are missing on `StockDeductQueue`.
- Successful Flow 2A deduction currently does not create a `StockExportSlip` sales voucher.
- Queue cancellation does not appear to sync back to OrderService.
- Product Approval workflow does not exist yet in ProductService or frontend.
- Docker is unavailable, so migration application cannot be verified until Docker is started.

## Next Recommended Action

- Continue to Phase 1 if the local environment can build .NET/frontend without Docker verification.
- Before any migration or service restart, re-check Docker availability.
- Implement Phase 1 in small backend-first slices: enum/schema/audit, status filtering, Manager/Admin authorization, confirm/cancel behavior, sales export slip, OrderService cancellation sync, then frontend wording/modals.

## Last Safe Local Commit Hash

- None yet for this overnight task.
